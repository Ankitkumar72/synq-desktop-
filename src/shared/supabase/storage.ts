import { supabase } from './supabase'

export async function compressImage(file: File, maxWidth = 1600): Promise<{ blob: Blob, dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          return reject(new Error('Canvas 2D context not available'))
        }

        ctx.drawImage(img, 0, 0, width, height)

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        canvas.toBlob((blob) => {
          if (blob) {
            resolve({ blob, dataUrl })
          } else {
            reject(new Error('Canvas toBlob failed'))
          }
        }, 'image/jpeg', 0.8)
      }
      img.onerror = () => reject(new Error('Failed to load image for compression'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export async function uploadImage(fileBlob: Blob, fileExtension: string = 'jpg'): Promise<string | null> {
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${fileExtension}`
  
  const { error } = await supabase.storage
    .from('images')
    .upload(fileName, fileBlob, {
      contentType: `image/${fileExtension}`,
      upsert: false
    })

  if (error) {
    console.error('[Storage] Upload failed:', error)
    return null
  }

  const { data: publicUrlData } = supabase.storage
    .from('images')
    .getPublicUrl(fileName)

  return publicUrlData.publicUrl
}
