type RDSCache = {
    key: string
    hours: number
}

type RDSGooglePlace = {
    placeId: string
    apiKey: string
}

type RDSConfig = {
    cache: RDSCache
    google: RDSGooglePlace
}