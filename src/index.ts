import { useEnv } from '@directus/env'
import { defineEndpoint } from '@directus/extensions'
import { createClient } from "redis"
import { RDSGooglePlace } from './handlers.js'

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
const RC = createClient({ url: redisUrl as string })
await RC.connect()

const GP = new RDSGooglePlace()

export default defineEndpoint((router) => {
    router.get('/', GP.get)

    router.get('/health', (_req, res) => res.sendStatus(200))
})