"use client"

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

export default function AuthCodeErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-destructive/20 shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl font-bold">Authentication Error</CardTitle>
          <CardDescription className="text-center text-muted-foreground pt-2">
            We encountered a problem while exchanging the login code for a session.
          </CardDescription>
          {error && (
            <div className="mt-4 p-3 rounded bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center font-mono">
              {error}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 text-sm leading-relaxed">
            <p className="font-semibold mb-2">Possible causes:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>The verification link has expired</li>
              <li>The link was already used</li>
              <li>A mismatch between browser tabs or sessions</li>
              <li>Supabase configuration mismatch (Client Secret)</li>
            </ul>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Link 
            href="/login" 
            className={buttonVariants({ variant: "default", className: "w-full" })}
          >
            Back to Login
          </Link>
          <p className="text-xs text-center text-muted-foreground">
            If this persists, please contact the administrator or check your Supabase dashboard settings.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
