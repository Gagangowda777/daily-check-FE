// A photo picked from the device is resized in the browser before it is sent:
// the API only ever receives a small JPEG data URL.

export const MAX_PHOTO_EDGE = 1280

export const pictureFromFile = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(
        1,
        MAX_PHOTO_EDGE / Math.max(image.naturalWidth, image.naturalHeight)
      )
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That photo could not be read.'))
    }
    image.src = url
  })
