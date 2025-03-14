import { useEnv } from '@directus/env'
import { Request, Response } from 'express'
import { createClient } from 'redis'
import { z } from 'zod'

const env = useEnv()

// Validate Redis connection
const redisUrl = env.REDIS || (
    env.REDIS_HOST && env.REDIS_PORT && env.REDIS_USERNAME && env.REDIS_PASSWORD
        ? `redis://${env.REDIS_USERNAME}:${env.REDIS_PASSWORD}@${env.REDIS_HOST}:${env.REDIS_PORT}`
        : null
)

if (!redisUrl) {
    throw new Error('Missing Redis configuration. Either REDIS or REDIS_HOST, REDIS_PORT, REDIS_USERNAME, and REDIS_PASSWORD must be provided.')
}

// Create and validate the config object directly
const config: RDSConfig = {
    cache: {
        hours: z.number().parse(env.REDIS_DGPE_CACHE_HOURS),
        key: z.string().parse(env.REDIS_DGPE_CACHE_KEY)
    },
    google: {
        apiKey: z.string().parse(env.GOOGLE_API_KEY),
        placeId: z.string().parse(env.GOOGLE_PLACE_ID)
    }
}


const RC = createClient({ url: redisUrl as string })
await RC.connect()

export class RDSGooglePlace {
    get = async (_req: Request, res: Response) => {
        try {
            // The key to store the cached data
            const redis_key = `${config.cache.key}-google-place`

            // Check for cached data
            const cached_data = await RC.get(redis_key)
            if (cached_data) {
                return res.json(JSON.parse(cached_data))
            }

            const endpoint = `https://places.googleapis.com/v1/places/${config.google.placeId}`
            const rsp = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': config.google.apiKey,
                    'X-Goog-FieldMask':
                        'id,internationalPhoneNumber,plusCode,googleMapsUri,regularOpeningHours,adrFormatAddress,currentOpeningHours,reviews',
                    'Accept-Language': 'en',
                },
            })

            const data = await rsp.json()

            await RC.set(
                redis_key,
                JSON.stringify(data),
                { EX: config.cache.hours * 60 * 60 }
            )

            return rsp.ok
                ? res.json(data)
                : res.status(rsp.status).send(rsp.statusText)
        } catch (error: unknown) {
            return res.status(500).send(
                error instanceof Error
                    ? error.message
                    : 'An unknown error occurred'
            )
        }
    }
}