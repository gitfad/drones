const create = async ({ testingMode }) => {
    const FASTIFY_SETTINGS = { logger: { level: testingMode ? 'error' : 'debug' } }
    const fastify = require('fastify')(FASTIFY_SETTINGS)

    const swagger = require('@fastify/swagger')
    const swaggerUI = require('@fastify/swagger-ui')
    const { fastifySchedulePlugin } = require('@fastify/schedule')
    const { SimpleIntervalJob, Task } = require('toad-scheduler')
    const fastifySqlite = require('fastify-sqlite')
    const Routes = require('./routes')
    const Drone = require('./models/drone')
    const Medication = require('./models/medication')
    const BatteryTracker = require('./models/battery-tracker')

    // plugin registering
    await fastify.register(fastifySqlite, { dbFile: ':memory:', verbose: true, promiseApi: true })
    await fastify.register(swagger, {
        swagger: {
            info: {
                title: 'Drones REST API Documentation',
                description: 'This is a REST API built on Fastify',
                contact: {
                    name: "FAD",
                    url: "https://fad.dev",
                    email: "me@fad.dev"
                },
                version: '1.0.0'
            },
        }
    })
    await fastify.register(swaggerUI, {
        routePrefix: '/docs',
        uiConfig: {
            docExpansion: 'full',
            deepLinking: false
        },
        uiHooks: {
            onRequest: function (request, reply, next) { next() },
            preHandler: function (request, reply, next) { next() }
        },
        staticCSP: true,
        transformStaticCSP: (header) => header,
        transformSpecification: (swaggerObject, request, reply) => { return swaggerObject },
        transformSpecificationClone: true
    })
    await fastify.register(fastifySchedulePlugin)

    // loading routes
    Routes.list.forEach(route => fastify.route(route))

    // loading tasks
    const batteriesLevelCheckerJob = new SimpleIntervalJob(
        { seconds: 60, },
        new Task('battery level checker', () => {
            console.log('Running task "battery level checker"...')
            Drone.checkBatteriesLevel(fastify.sqlite)
        }
        ))

    // plugin initializations
    fastify.ready().then(() => {
        console.log('fastify plugins loaded!')
        fastify.swagger()
        Drone.initialize(fastify.sqlite)
        Medication.initialize(fastify.sqlite)
        BatteryTracker.initialize(fastify.sqlite)
        fastify.scheduler.addSimpleIntervalJob(batteriesLevelCheckerJob)
    }).catch((err) => {
        console.log('an error happened on booting', err)
    })

    if (!testingMode) {
        // starting the server
        fastify.listen({ port: 3000 }).then(() => {
            console.log('fastify server started!')
        }).catch((err) => {
            fastify.log.error(err)
            process.exit(1)
        })
    }

    return fastify
}

module.exports = {
    create
}