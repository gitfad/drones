const Drone = require('./models/drone')
const Medication = require('./models/medication')

const POST = 'POST'
const GET = 'GET'
const DRONES_PATH = '/drones'
const MEDICATION_ITEMS_PATH = '/medication-items'
const AVAILABILITY_PATH = '/availability'
const BATTERY_LEVEL_PATH = '/battery-level'
const SERIAL_NUMBER_PARAM_PATH = '/:serialNumber'
const LOADING_PATH = '/loading'

const DRONE_NOT_FOUND = 'drone not found'

const DRONE_SCHEMA = {
    type: 'object',
    properties: {
        serialNumber: { type: 'string', maxLength: Drone.MAXIMUM_SERIAL_NUMBER_LENGTH },
        model: { 'enum': Drone.MODEL_TYPES },
        weightLimit: { type: 'number', minimum: 0, maximum: Drone.MAXIMUM_WEIGHT_LIMIT },
        batteryLevel: { type: 'number', minimum: 0, maximum: Drone.MAXIMUM_BATTERY_CAPACITY },
        state: { 'enum': Drone.STATE_TYPES },
    }
}

const DRONE_REGISTRATION_SCHEMA = {
    type: 'object',
    properties: {
        serialNumber: { type: 'string', maxLength: Drone.MAXIMUM_SERIAL_NUMBER_LENGTH },
        model: { 'enum': Drone.MODEL_TYPES },
        batteryLevel: { type: 'number', minimum: 0, maximum: Drone.MAXIMUM_BATTERY_CAPACITY },
    }
}

const SERIAL_NUMBER_SCHEMA = {
    type: 'object',
    required: ['serialNumber',],
    properties: {
        serialNumber: { type: 'string', maxLength: Drone.MAXIMUM_SERIAL_NUMBER_LENGTH },
    }
}

const RESULTS_SCHEMA = {
    type: 'object',
    properties: {
        size: { type: 'number' },
        results: { type: 'array' },
    }
}

const NUMBER_RESULT_SCHEMA = { type: 'number' }

const ERROR_SCHEMA = {
    type: 'object',
    properties: {
        message: { type: 'string' },
    }
}

const registerDrone = {
    method: POST,
    url: DRONES_PATH,
    schema: {
        description: 'Register a drone with initial battery level',
        body: DRONE_REGISTRATION_SCHEMA,
        response: {
            200: DRONE_SCHEMA
        }
    },
    handler: async (request, reply) => {
        const { serialNumber, model, batteryLevel } = request.body
        try {
            return await Drone.register(request.server.sqlite, serialNumber, model, batteryLevel)
        } catch (err) {
            reply.code(400).send({ message: err.message })
        }
    }
}

const loadDroneWithMedicationItems = {
    method: POST,
    url: DRONES_PATH + SERIAL_NUMBER_PARAM_PATH + MEDICATION_ITEMS_PATH,
    schema: {
        description: 'Load a registered drone with more medical items',
        params: SERIAL_NUMBER_SCHEMA,
        body: {
            type: 'array'
        },
        response: {
            200: RESULTS_SCHEMA
        }
    },
    handler: async (request, reply) => {
        const { serialNumber } = request.params
        const medicationItems = request.body

        try {
            const results = await Medication.loadDrone(request.server.sqlite, serialNumber, medicationItems)
            return { size: results.length, results }
        } catch (err) {
            if (err.message === 'drone didn\'t exists') {
                reply.code(404).send({ message: DRONE_NOT_FOUND });
            } else {
                reply.code(400).send({ message: err.message });
            }
        }
    }
}

const getDroneMedicationItemsLoaded = {
    method: GET,
    url: DRONES_PATH + SERIAL_NUMBER_PARAM_PATH + MEDICATION_ITEMS_PATH,
    schema: {
        description: 'Get the current medical items from a registered drone',
        params: SERIAL_NUMBER_SCHEMA,
        response: {
            200: RESULTS_SCHEMA
        }
    },
    handler: async (request, reply) => {
        const { serialNumber } = request.params
        try {
            const results = await Medication.getDroneLoad(request.server.sqlite, serialNumber)
            return { size: results.length, results }
        } catch (err) {
            if (err.message === 'drone didn\'t exists') {
                reply.code(404).send({ message: DRONE_NOT_FOUND });
            } else {
                reply.code(400).send({ message: err.message });
            }
        }
    }
}

const getDronesLoadingAvailability = {
    method: GET,
    url: DRONES_PATH + AVAILABILITY_PATH + LOADING_PATH,
    schema: {
        description: 'Get all available drones to be loaded with more medical items',
        response: {
            200: RESULTS_SCHEMA
        }
    },
    handler: async (request, reply) => {
        const results = await Drone.getAllLoadingAvailability(request.server.sqlite)
        return { size: results.length, results }
    }
}

const getDroneBatteryLevel = {
    method: GET,
    url: DRONES_PATH + SERIAL_NUMBER_PARAM_PATH + BATTERY_LEVEL_PATH,
    schema: {
        description: 'Get the current battery level from a registered drone',
        params: SERIAL_NUMBER_SCHEMA,
        response: {
            200: NUMBER_RESULT_SCHEMA,
            404: ERROR_SCHEMA
        }
    },
    handler: async (request, reply) => {
        const { serialNumber } = request.params
        const drone = await Drone.get(request.server.sqlite, serialNumber)
        if (drone === undefined) {
            reply.code(404).send({ message: DRONE_NOT_FOUND })
        } else {
            return drone.batteryLevel
        }
    }
}

module.exports = {
    DRONES_PATH,
    MEDICATION_ITEMS_PATH,
    AVAILABILITY_PATH,
    LOADING_PATH,
    BATTERY_LEVEL_PATH,
    DRONE_NOT_FOUND,
    list: [
        registerDrone,
        loadDroneWithMedicationItems,
        getDroneMedicationItemsLoaded,
        getDronesLoadingAvailability,
        getDroneBatteryLevel
    ]
}