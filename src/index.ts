import { useEnv } from '@directus/env'
import type { EndpointConfig } from '@directus/extensions'
import { createClient } from "redis"

// Create a new Redis client
const env = useEnv()

const redisUrl = env.REDIS ||
    (env.REDIS_HOST && env.REDIS_PORT && env.REDIS_USERNAME && env.REDIS_PASSWORD
        ? `redis://${env.REDIS_USERNAME}:${env.REDIS_PASSWORD}@${env.REDIS_HOST}:${env.REDIS_PORT}`
        : null)
if (!redisUrl) {
    throw new Error(
        'Missing Redis configuration. Either REDIS or REDIS_HOST, REDIS_PORT, REDIS_USERNAME, and REDIS_PASSWORD must be provided.'
    )
}

// Retrieve the Redis URL from environment variables or default to 'redis://cache:6379'
// const redisUrl = redis_url || 'redis://cache:6379'
const RC = createClient({ url: redisUrl as string })
await RC.connect()

export default {
    id: 'google-place',
    handler: (router, ctx) => {
        router.get('/', async (_req, res) => {
            try {
                // Check if the required environment variables are set
                const requiredEnvVars = [
                    'REDIS_DGPE_CACHE_KEY',
                    'REDIS_DGPE_CACHE_HOURS',
                    'GOOGLE_PLACE_ID',
                    'GOOGLE_API_KEY',
                ]
                requiredEnvVars.forEach(v => {
                    if (!ctx.env[v]) {
                        throw new Error(`Missing environment variable ${v}`)
                    }
                })

                // The key to store the cached data
                const redis_key = `${ctx.env.REDIS_DGPE_CACHE_KEY}-google-place`

                // Check for cached data
                const cached_data = await RC.get(redis_key)
                if (cached_data) {
                    res.json(JSON.parse(cached_data))
                    return
                }

                const endpoint = `https://places.googleapis.com/v1/places/${ctx.env.GOOGLE_PLACE_ID}`
                const rsp = await fetch(endpoint, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': ctx.env.GOOGLE_API_KEY,
                        'X-Goog-FieldMask':
                            'id,internationalPhoneNumber,plusCode,googleMapsUri,regularOpeningHours,adrFormatAddress,currentOpeningHours,reviews',
                        'Accept-Language': 'en',
                    },
                })

                const data = await rsp.json()

                await RC.set(
                    redis_key,
                    JSON.stringify(data),
                    { EX: ctx.env.REDIS_DGPE_CACHE_HOURS * 60 * 60 }
                )

                rsp.ok
                    ? res.json(data)
                    : res.status(rsp.status).send(rsp.statusText)
            } catch (error: unknown) {
                res.status(500).send(
                    error instanceof Error
                        ? error.message
                        : 'An unknown error occurred'
                )
            }
        })
    },
} as EndpointConfig
