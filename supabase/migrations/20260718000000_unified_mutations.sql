-- Migration: 20260718000000_unified_mutations
-- Description: Creates the mutations_log table for idempotency and the apply_mutations bulk RPC

CREATE TABLE IF NOT EXISTS public.mutations_log (
    mutation_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT,
    client_id TEXT,
    operation_type TEXT NOT NULL,
    server_sequence BIGSERIAL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for sequence ordering and client debugging
CREATE INDEX IF NOT EXISTS idx_mutations_log_user_seq ON public.mutations_log(user_id, server_sequence);

-- RPC for applying a batch of mutations idempotently
CREATE OR REPLACE FUNCTION public.apply_mutations(
    p_mutations JSONB[]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_mut JSONB;
    v_mutation_id UUID;
    v_op_type TEXT;
    v_user_id UUID := auth.uid();
    v_server_seq BIGINT;
    v_results JSONB := '[]'::jsonb;
BEGIN
    -- We assume the client sends an array of mutation objects
    FOREACH v_mut IN ARRAY p_mutations LOOP
        v_mutation_id := (v_mut->>'mutation_id')::uuid;
        v_op_type := v_mut->>'operation_type';
        
        -- Check if already processed (Idempotency guarantee)
        IF EXISTS (SELECT 1 FROM public.mutations_log WHERE mutation_id = v_mutation_id) THEN
            SELECT server_sequence INTO v_server_seq FROM public.mutations_log WHERE mutation_id = v_mutation_id;
            
            v_results := v_results || jsonb_build_object(
                'mutation_id', v_mutation_id,
                'status', 'duplicate',
                'server_sequence', v_server_seq,
                'server_timestamp', (extract(epoch from now()) * 1000)::bigint
            );
            CONTINUE;
        END IF;

        -- Here we would parse operation_type and apply to appropriate tables.
        -- For now, we stub this out or route it to existing logic.
        -- E.g., IF v_op_type = 'TASK_UPDATE' THEN ... END IF;
        
        -- Log the mutation for idempotency
        INSERT INTO public.mutations_log (mutation_id, user_id, device_id, client_id, operation_type)
        VALUES (
            v_mutation_id, 
            v_user_id, 
            v_mut->>'device_id', 
            v_mut->>'client_id', 
            v_op_type
        ) RETURNING server_sequence INTO v_server_seq;

        -- Return ACK
        v_results := v_results || jsonb_build_object(
            'mutation_id', v_mutation_id,
            'status', 'applied',
            'server_sequence', v_server_seq,
            'server_timestamp', (extract(epoch from now()) * 1000)::bigint
        );
    END LOOP;
    
    RETURN v_results;
END;
$$;
