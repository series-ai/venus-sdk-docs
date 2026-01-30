# Image Generation API (BETA)

AI-powered image generation for creating custom visuals in your games.

---

## Overview

The Image Generation API enables games to generate images using AI from text prompts. Perfect for creating custom avatars, item icons, scene backgrounds, or any visual content your game needs.

**Key Features:**
- 🎨 **Text-to-Image** generation with detailed prompts
- 📐 **Flexible Aspect Ratios** for different use cases
- 🖼️ **Reference Images** for style/content guidance
- 🔒 **Content Moderation** to ensure safe output
- ☁️ **Cloud Storage** with CDN-backed URLs

> **Note:** This API is currently available only for Series AI first-party games.

---

## Quick Start

### Basic Image Generation

```typescript
// Generate a simple image
const result = await VenusAPI.imageGen.generate({
  prompt: 'A cute cartoon cat wearing a wizard hat, digital art style'
})

console.log(`Generated image: ${result.imageUrl}`)
```

### With Options

```typescript
// Generate with more control
const result = await VenusAPI.imageGen.generate({
  prompt: 'A fantasy landscape with floating islands at sunset',
  aspectRatio: '16:9',
  negativePrompt: 'blurry, low quality, text, watermark',
  seed: 12345  // For reproducible results
})
```

### Using Reference Images

```typescript
// Generate based on reference images
const result = await VenusAPI.imageGen.generate({
  prompt: 'A character portrait in this art style',
  referenceImages: [
    'https://example.com/style-reference.jpg'
  ],
  aspectRatio: '1:1'
})
```

---

## API Reference

### generate(params)

Generates an image from a text prompt.

**Parameters:**

```typescript
interface ImageGenParams {
  prompt: string              // Required: Description of the image to generate
  negativePrompt?: string     // Optional: Things to avoid in the image
  aspectRatio?: AspectRatio   // Optional: Image dimensions (default: '1:1')
  referenceImages?: string[]  // Optional: URLs for style/content reference (max 5)
  seed?: number               // Optional: For reproducible generation
}

type AspectRatio = 
  | '1:1'   // Square (default)
  | '2:3'   // Portrait
  | '3:2'   // Landscape
  | '3:4'   // Portrait
  | '4:3'   // Landscape
  | '4:5'   // Portrait (social media)
  | '5:4'   // Landscape
  | '9:16'  // Vertical (stories/reels)
  | '16:9'  // Widescreen
  | '21:9'  // Ultrawide
```

**Returns:**

```typescript
interface ImageGenResult {
  imageUrl: string  // CDN URL of the generated image
  prompt: string    // The prompt used for generation
}
```

**Example:**

```typescript
const result = await VenusAPI.imageGen.generate({
  prompt: 'A mystical forest with glowing mushrooms',
  aspectRatio: '16:9',
  negativePrompt: 'people, text, watermark'
})

// Use the image
const img = new Image()
img.src = result.imageUrl
```

---

## Use Cases

### Avatar Generation

```typescript
async function generateAvatar(description: string): Promise<string> {
  const result = await VenusAPI.imageGen.generate({
    prompt: `Portrait of ${description}, centered headshot, clean background, digital art`,
    aspectRatio: '1:1',
    negativePrompt: 'full body, multiple people, text'
  })
  return result.imageUrl
}

// Usage
const avatarUrl = await generateAvatar('a friendly robot with blue eyes')
```

### Item Icons

```typescript
async function generateItemIcon(itemName: string, itemType: string): Promise<string> {
  const result = await VenusAPI.imageGen.generate({
    prompt: `Game icon of ${itemName}, ${itemType} item, fantasy RPG style, clean icon design`,
    aspectRatio: '1:1',
    negativePrompt: 'text, complex background, realistic'
  })
  return result.imageUrl
}

// Usage
const swordIcon = await generateItemIcon('Flame Sword', 'weapon')
```

### Scene Backgrounds

```typescript
async function generateBackground(scene: string): Promise<string> {
  const result = await VenusAPI.imageGen.generate({
    prompt: `${scene}, game background art, detailed environment, no characters`,
    aspectRatio: '16:9',
    negativePrompt: 'people, text, UI elements'
  })
  return result.imageUrl
}

// Usage
const forestBg = await generateBackground('enchanted forest at twilight')
```

---

## Best Practices

### Writing Effective Prompts

```typescript
// Good: Specific, descriptive prompt
const result = await VenusAPI.imageGen.generate({
  prompt: 'A steampunk airship flying over Victorian London at sunset, ' +
          'copper and brass details, steam clouds, warm golden lighting, ' +
          'highly detailed digital painting',
  negativePrompt: 'modern elements, cars, airplanes'
})

// Bad: Vague prompt
const result = await VenusAPI.imageGen.generate({
  prompt: 'cool ship'  // Too vague, unpredictable results
})
```

### Using Negative Prompts

```typescript
// Control what NOT to include
const result = await VenusAPI.imageGen.generate({
  prompt: 'Portrait of a fantasy warrior',
  negativePrompt: 'blurry, low quality, text, watermark, ' +
                  'multiple people, cropped, out of frame'
})
```

### Handling Generation Time

Image generation typically takes 5-15 seconds. Show appropriate loading states:

```typescript
async function generateWithLoading() {
  setLoading(true)
  setLoadingText('Creating your image...')
  
  try {
    const result = await VenusAPI.imageGen.generate({
      prompt: userPrompt
    })
    setImageUrl(result.imageUrl)
  } catch (error) {
    showError('Failed to generate image. Please try again.')
  } finally {
    setLoading(false)
  }
}
```

### Error Handling

```typescript
try {
  const result = await VenusAPI.imageGen.generate({
    prompt: userPrompt
  })
} catch (error) {
  if (error.message.includes('inappropriate')) {
    showToast('Please revise your prompt and try again.')
  } else if (error.message.includes('rate limit')) {
    showToast('Too many requests. Please wait a moment.')
  } else {
    showToast('Image generation failed. Please try again.')
  }
}
```

### Caching Generated Images

```typescript
// Cache results to avoid regenerating the same images
const imageCache = new Map<string, string>()

async function generateCached(prompt: string): Promise<string> {
  const cacheKey = prompt.toLowerCase().trim()
  
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey)!
  }
  
  const result = await VenusAPI.imageGen.generate({ prompt })
  imageCache.set(cacheKey, result.imageUrl)
  return result.imageUrl
}
```

---

## Reference Images

Use reference images to guide style or content:

```typescript
// Style transfer
const result = await VenusAPI.imageGen.generate({
  prompt: 'A mountain landscape in this artistic style',
  referenceImages: ['https://cdn.example.com/art-style.jpg']
})

// Character consistency
const result = await VenusAPI.imageGen.generate({
  prompt: 'The same character but in a battle pose',
  referenceImages: ['https://cdn.example.com/character.jpg']
})
```

**Reference Image Requirements:**
- Must be HTTPS URLs
- Must be publicly accessible
- Maximum 5 reference images per request
- Maximum 10MB per image
- Supported formats: PNG, JPG, WebP, GIF

---

## Limits & Constraints

| Limit | Value |
|-------|-------|
| Max prompt length | 4,000 characters |
| Max reference images | 5 per request |
| Max reference image size | 10MB each |
| Generation time | 5-30 seconds typical |
| Output format | PNG or JPEG |
| Image storage | Permanent CDN URLs |

---

## Security & Content Policy

- **Authentication Required**: All requests require a logged-in user
- **Series AI Apps Only**: Currently restricted to first-party games
- **Content Moderation**: Prompts are automatically checked for inappropriate content
- **Safe Output**: Generated images follow content safety guidelines
- **No NSFW Content**: Adult or explicit content is not supported

---

## Technical Notes

### Image URLs

Generated images are stored on Firebase Storage with public CDN access:

```typescript
const result = await VenusAPI.imageGen.generate({ prompt: '...' })
// result.imageUrl is a permanent, publicly accessible URL
// Format: https://storage.googleapis.com/[bucket]/h5-imagegen/[appId]/[profileId]/[uuid].png
```

### Reproducibility with Seeds

Use the `seed` parameter to get reproducible results:

```typescript
// Same seed + same prompt = same image
const result1 = await VenusAPI.imageGen.generate({
  prompt: 'A blue dragon',
  seed: 42
})

const result2 = await VenusAPI.imageGen.generate({
  prompt: 'A blue dragon',
  seed: 42
})
// result1.imageUrl content ≈ result2.imageUrl content
```

---

## Features Summary

- **Text-to-Image**: Generate images from natural language descriptions
- **Aspect Ratios**: 10 preset ratios for different use cases
- **Negative Prompts**: Control what to exclude from generated images
- **Reference Images**: Guide generation with style/content references
- **Reproducibility**: Use seeds for consistent results
- **Cloud Storage**: Permanent CDN-backed image URLs
- **Content Safety**: Automatic moderation of prompts and outputs
