const FASTIFY_SETTINGS = { logger: true }
const fastify = require('fastify')(FASTIFY_SETTINGS)
const Drone = require('./models/drone')
const Medication = require('./models/medication')
const fastifySqlite = require('fastify-sqlite')

fastify.register(fastifySqlite, { dbFile: ':memory:', verbose: true, promiseApi: true });

const start = async () => {
    try {
        await fastify.listen({ port: 3000 })
        await Drone.initialize(fastify.sqlite)
        await Medication.initialize(fastify.sqlite)
    } catch (err) {
        fastify.log.error(err)
        process.exit(1)
    }
}
start()