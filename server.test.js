import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { v4 as uuidv4 } from 'uuid';
const API = require('./api')
const Routes = require('./routes')
const Drone = require('./models/drone')
const Medication = require('./models/medication')

let api, port, base

beforeAll(async () => {
    api = await API.create({ testingMode: true })
    await api.listen()
    port = api.server.address().port
    base = path => `http://localhost:${port}${path}`
})

afterAll(async () => {
    await api.close()
})

const getMockedRegistrationDrone = () => ({
    serialNumber: uuidv4(),
    model: Drone.MODEL_HEAVY_TYPE,
    batteryLevel: 60
})

const getMockedMedicalItem = () => ({
    code: uuidv4().toUpperCase().replaceAll('-', '_'),
    name: uuidv4().replaceAll('-', ''),
    weight: Math.round(Math.random() * 100), // mocked MODEL_HEAVY_TYPE supports 5 mocked items
    imageBase64: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
})

describe('drone', () => {
    test('should fail the drone registration with 101 chars serial number', async () => {
        const droneData = { ...getMockedRegistrationDrone(), serialNumber: 'a'.repeat(101) }

        const response = await fetch(base(Routes.DRONES_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(droneData)
        })
        expect(response.status).toBe(400)

        const jsonResponse = await response.json()
        expect(jsonResponse).toBeTruthy()
        expect(jsonResponse.message).toBe('body/serialNumber must NOT have more than 100 characters')
    })

    test('should fail the drone registration with invalid model', async () => {
        const droneData = { ...getMockedRegistrationDrone(), model: 'invalidModel' }

        const response = await fetch(base(Routes.DRONES_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(droneData)
        })
        expect(response.status).toBe(400)

        const jsonResponse = await response.json()
        expect(jsonResponse).toBeTruthy()
        expect(jsonResponse.message).toBe('body/model must be equal to one of the allowed values')
    })

    test('should fail the drone registration with invalid battery level', async () => {
        const droneData = { ...getMockedRegistrationDrone(), batteryLevel: 150 }

        const response = await fetch(base(Routes.DRONES_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(droneData)
        })
        expect(response.status).toBe(400)

        const jsonResponse = await response.json()
        expect(jsonResponse).toBeTruthy()
        expect(jsonResponse.message).toBe('body/batteryLevel must be <= 100')
    })

    test('should fail registering the same drone serial number twice', async () => {
        const droneData = { ...getMockedRegistrationDrone(), serialNumber: 'a1a1a1a1a1' }

        let response = await fetch(base(Routes.DRONES_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(droneData)
        })
        expect(response.status).toBe(200)

        response = await fetch(base(Routes.DRONES_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(droneData)
        })
        expect(response.status).toBe(400)

        const jsonResponse = await response.json()
        expect(jsonResponse).toBeTruthy()
        expect(jsonResponse.message).toBe('drone already exists')
    })

    test('should register a drone', async () => {
        const droneData = getMockedRegistrationDrone()

        const response = await fetch(base(Routes.DRONES_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(droneData)
        })
        expect(response.status).toBe(200)

        const jsonResponse = await response.json()
        expect(jsonResponse).toBeTruthy()
        expect(jsonResponse.serialNumber).toBe(droneData.serialNumber)
        expect(jsonResponse.model).toBe(droneData.model)
        expect(jsonResponse.batteryLevel).toBe(droneData.batteryLevel)
        expect(jsonResponse.state).toBe(Drone.STATE_IDLE_TYPE)
        expect(jsonResponse.weightLimit).toBeGreaterThan(0)
    })

    test('should get available drones for loading', async () => {
        await Drone.cleanUp(api.sqlite)
        await Medication.cleanUp(api.sqlite)

        const droneDataA = { ...getMockedRegistrationDrone(), batteryLevel: 75 }

        let response = await fetch(base(Routes.DRONES_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(droneDataA)
        })
        expect(response.status).toBe(200)

        const droneDataB = { ...getMockedRegistrationDrone(), batteryLevel: 75 }

        response = await fetch(base(Routes.DRONES_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(droneDataB)
        })
        expect(response.status).toBe(200)

        response = await fetch(base(Routes.DRONES_PATH + Routes.AVAILABILITY_PATH + Routes.LOADING_PATH), {
            method: 'GET',
            headers: { "Content-Type": "application/json" }
        })
        expect(response.status).toBe(200)

        const jsonResponse = await response.json()
        expect(jsonResponse).toBeTruthy()
        expect(jsonResponse.size).toBe(2)
        expect(jsonResponse.results).toBeTruthy()

        const dronesData = [ droneDataA, droneDataB ]
        for (let idx = 0; idx < dronesData.length; idx++) {
            const droneData = dronesData[idx]
            const resultItem = jsonResponse.results.find(item => item.serialNumber === droneData.serialNumber)
            expect(resultItem).toBeTruthy()
            expect(resultItem.serialNumber).toBe(droneData.serialNumber)
            expect(resultItem.model).toBe(droneData.model)
            expect(resultItem.batteryLevel).toBe(droneData.batteryLevel)
            expect(resultItem.state).toBe(Drone.STATE_IDLE_TYPE)
        }
    })

    test('should get available drones for loading excluding drones with battery level below 25%', async () => {
        await Drone.cleanUp(api.sqlite)
        await Medication.cleanUp(api.sqlite)

        const droneDataA = { ...getMockedRegistrationDrone(), batteryLevel: 10 }

        let response = await fetch(base(Routes.DRONES_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(droneDataA)
        })
        expect(response.status).toBe(200)

        const droneDataB = { ...getMockedRegistrationDrone(), batteryLevel: 75 }

        response = await fetch(base(Routes.DRONES_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(droneDataB)
        })
        expect(response.status).toBe(200)

        response = await fetch(base(Routes.DRONES_PATH + Routes.AVAILABILITY_PATH + Routes.LOADING_PATH), {
            method: 'GET',
            headers: { "Content-Type": "application/json" }
        })
        expect(response.status).toBe(200)

        const jsonResponse = await response.json()
        expect(jsonResponse).toBeTruthy()
        expect(jsonResponse.size).toBe(1)
        expect(jsonResponse.results).toBeTruthy()

        const resultItem = jsonResponse.results[0]
        expect(resultItem).toBeTruthy()
        expect(resultItem.serialNumber).toBe(droneDataB.serialNumber)
        expect(resultItem.model).toBe(droneDataB.model)
        expect(resultItem.batteryLevel).toBe(droneDataB.batteryLevel)
        expect(resultItem.state).toBe(Drone.STATE_IDLE_TYPE)
    })

    test('should fail getting the battery level from an unregistered drone', async () => {
        const serialNumber = getMockedRegistrationDrone().serialNumber

        const response = await fetch(base(Routes.DRONES_PATH + '/' + serialNumber + Routes.BATTERY_LEVEL_PATH), {
            method: 'GET',
            headers: { "Content-Type": "application/json" }
        })
        expect(response.status).toBe(404)

        const jsonResponse = await response.json()
        expect(jsonResponse).toBeTruthy()
        expect(jsonResponse.message).toBe('drone not found')
    })

    test('should get the battery level from a drone', async () => {
        const droneData = { ...getMockedRegistrationDrone(), batteryLevel: 33 }

        let response = await fetch(base(Routes.DRONES_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(droneData)
        })
        expect(response.status).toBe(200)

        response = await fetch(base(Routes.DRONES_PATH + '/' + droneData.serialNumber + Routes.BATTERY_LEVEL_PATH), {
            method: 'GET',
            headers: { "Content-Type": "application/json" }
        })
        expect(response.status).toBe(200)

        expect(await response.text()).toBe(`${droneData.batteryLevel}`)
    })
})

describe('medical items', () => {
    test('should fail loading a drone with an invalid medical item name', async () => {
        const droneData = getMockedRegistrationDrone()

        let response = await fetch(base(Routes.DRONES_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(droneData)
        })
        expect(response.status).toBe(200)

        const medicalItemsData = [{ ...getMockedMedicalItem(), name: 'invalid.name$' }]
        response = await fetch(base(Routes.DRONES_PATH + '/' + droneData.serialNumber + Routes.MEDICATION_ITEMS_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(medicalItemsData)
        })
        expect(response.status).toBe(400)

        const jsonResponse = await response.json()
        expect(jsonResponse).toBeTruthy()
        expect(jsonResponse.message).toBe('invalid name field value')
    })

    test('should fail loading a drone with an invalid medical item weight', async () => {
        const droneData = getMockedRegistrationDrone()

        let response = await fetch(base(Routes.DRONES_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(droneData)
        })
        expect(response.status).toBe(200)

        const medicalItemsData = [{ ...getMockedMedicalItem(), weight: Drone.MAXIMUM_WEIGHT_LIMIT + 1 }]
        response = await fetch(base(Routes.DRONES_PATH + '/' + droneData.serialNumber + Routes.MEDICATION_ITEMS_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(medicalItemsData)
        })
        expect(response.status).toBe(400)

        const jsonResponse = await response.json()
        expect(jsonResponse).toBeTruthy()
        expect(jsonResponse.message).toBe('invalid weight field value')
    })

    test('should fail loading a drone with an invalid medical item code', async () => {
        const droneData = getMockedRegistrationDrone()

        let response = await fetch(base(Routes.DRONES_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(droneData)
        })
        expect(response.status).toBe(200)

        const medicalItemsData = [{ ...getMockedMedicalItem(), code: 'invalid.code$' }]
        response = await fetch(base(Routes.DRONES_PATH + '/' + droneData.serialNumber + Routes.MEDICATION_ITEMS_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(medicalItemsData)
        })
        expect(response.status).toBe(400)

        const jsonResponse = await response.json()
        expect(jsonResponse).toBeTruthy()
        expect(jsonResponse.message).toBe('invalid code field value')
    })

    test('should fail loading a drone with an invalid medical item imageBase64', async () => {
        const droneData = getMockedRegistrationDrone()

        let response = await fetch(base(Routes.DRONES_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(droneData)
        })
        expect(response.status).toBe(200)

        const medicalItemsData = [{ ...getMockedMedicalItem(), imageBase64: 'invalid.imageBase64$' }]
        response = await fetch(base(Routes.DRONES_PATH + '/' + droneData.serialNumber + Routes.MEDICATION_ITEMS_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(medicalItemsData)
        })
        expect(response.status).toBe(400)

        const jsonResponse = await response.json()
        expect(jsonResponse).toBeTruthy()
        expect(jsonResponse.message).toBe('invalid imageBase64 field value')
    })

    test('should fail loading a drone with more medical items weight than it supports', async () => {
        const droneData = { ...getMockedRegistrationDrone(), model: Drone.MODEL_HEAVY_TYPE }

        let response = await fetch(base(Routes.DRONES_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(droneData)
        })
        expect(response.status).toBe(200)

        const medicalItemsData = [ {...getMockedMedicalItem(), weight: 300 }, {...getMockedMedicalItem(), weight: 300 } ]
        response = await fetch(base(Routes.DRONES_PATH + '/' + droneData.serialNumber + Routes.MEDICATION_ITEMS_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(medicalItemsData)
        })
        expect(response.status).toBe(400)

        const jsonResponse = await response.json()
        expect(jsonResponse).toBeTruthy()
        expect(jsonResponse.message).toBe('drone weight limit reached')
    })

    test('should fail loading a drone with more medical items weight than it supports for the second time', async () => {
        const droneData = { ...getMockedRegistrationDrone(), model: Drone.MODEL_HEAVY_TYPE }

        let response = await fetch(base(Routes.DRONES_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(droneData)
        })
        expect(response.status).toBe(200)

        let medicalItemsData = [ {...getMockedMedicalItem(), weight: 300 } ]
        response = await fetch(base(Routes.DRONES_PATH + '/' + droneData.serialNumber + Routes.MEDICATION_ITEMS_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(medicalItemsData)
        })
        expect(response.status).toBe(200)

        medicalItemsData = [ {...getMockedMedicalItem(), weight: 300 } ]
        response = await fetch(base(Routes.DRONES_PATH + '/' + droneData.serialNumber + Routes.MEDICATION_ITEMS_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(medicalItemsData)
        })
        expect(response.status).toBe(400)

        const jsonResponse = await response.json()
        expect(jsonResponse).toBeTruthy()
        expect(jsonResponse.message).toBe('drone weight limit reached')
    })

    test('should fail loading a drone with medical items when it has battery level below 25%', async () => {
        const droneData = { ...getMockedRegistrationDrone(), batteryLevel: 15 }

        let response = await fetch(base(Routes.DRONES_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(droneData)
        })
        expect(response.status).toBe(200)

        const medicalItemsData = [getMockedMedicalItem()]
        response = await fetch(base(Routes.DRONES_PATH + '/' + droneData.serialNumber + Routes.MEDICATION_ITEMS_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(medicalItemsData)
        })
        expect(response.status).toBe(400)

        const jsonResponse = await response.json()
        expect(jsonResponse).toBeTruthy()
        expect(jsonResponse.message).toBe('drone without enough battery level')
    })

    test('should load a drone with medical items', async () => {
        const droneData = getMockedRegistrationDrone()

        let response = await fetch(base(Routes.DRONES_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(droneData)
        })
        expect(response.status).toBe(200)

        const medicalItemsData = [getMockedMedicalItem(), getMockedMedicalItem()]
        response = await fetch(base(Routes.DRONES_PATH + '/' + droneData.serialNumber + Routes.MEDICATION_ITEMS_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(medicalItemsData)
        })
        expect(response.status).toBe(200)

        const jsonResponse = await response.json()
        expect(jsonResponse).toBeTruthy()
        expect(jsonResponse.size).toBe(medicalItemsData.length)
        expect(jsonResponse.results).toBeTruthy()

        for (let idx = 0; idx < medicalItemsData.length; idx++) {
            const medicalItemData = medicalItemsData[idx]
            const resultItem = jsonResponse.results.find(item => item.code === medicalItemData.code)
            expect(resultItem).toBeTruthy()
            expect(resultItem.code).toBe(medicalItemData.code)
            expect(resultItem.name).toBe(medicalItemData.name)
            expect(resultItem.weight).toBe(medicalItemData.weight)
            expect(resultItem.imageBase64).toBe(medicalItemData.imageBase64)
        }
    })

    test('should fail getting the medical items from an unregistered drone', async () => {
        const serialNumber = getMockedRegistrationDrone().serialNumber

        const response = await fetch(base(Routes.DRONES_PATH + '/' + serialNumber + Routes.MEDICATION_ITEMS_PATH), {
            method: 'GET',
            headers: { "Content-Type": "application/json" }
        })
        expect(response.status).toBe(404)

        const jsonResponse = await response.json()
        expect(jsonResponse).toBeTruthy()
        expect(jsonResponse.message).toBe(Routes.DRONE_NOT_FOUND)
    })

    test('should get the medical items from an empty drone', async () => {
        const droneData = getMockedRegistrationDrone()

        let response = await fetch(base(Routes.DRONES_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(droneData)
        })
        expect(response.status).toBe(200)

        response = await fetch(base(Routes.DRONES_PATH + '/' + droneData.serialNumber + Routes.MEDICATION_ITEMS_PATH), {
            method: 'GET',
            headers: { "Content-Type": "application/json" }
        })
        expect(response.status).toBe(200)

        const jsonResponse = await response.json()
        expect(jsonResponse).toBeTruthy()
        expect(jsonResponse.size).toBe(0)
        expect(jsonResponse.results).toMatchObject([])
    })

    test('should get the medical items from a loaded drone', async () => {
        const droneData = getMockedRegistrationDrone()

        let response = await fetch(base(Routes.DRONES_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(droneData)
        })
        expect(response.status).toBe(200)

        const medicalItemData = getMockedMedicalItem()
        response = await fetch(base(Routes.DRONES_PATH + '/' + droneData.serialNumber + Routes.MEDICATION_ITEMS_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify([medicalItemData])
        })
        expect(response.status).toBe(200)

        response = await fetch(base(Routes.DRONES_PATH + '/' + droneData.serialNumber + Routes.MEDICATION_ITEMS_PATH), {
            method: 'GET',
            headers: { "Content-Type": "application/json" }
        })
        expect(response.status).toBe(200)

        const jsonResponse = await response.json()
        expect(jsonResponse).toBeTruthy()
        expect(jsonResponse.size).toBe(1)
        expect(jsonResponse.results).toBeTruthy()

        const uniqueResultItem = jsonResponse.results[0]
        expect(uniqueResultItem).toBeTruthy()
        expect(uniqueResultItem.code).toBe(medicalItemData.code)
        expect(uniqueResultItem.name).toBe(medicalItemData.name)
        expect(uniqueResultItem.weight).toBe(medicalItemData.weight)
        expect(uniqueResultItem.imageBase64).toBe(medicalItemData.imageBase64)
    })
})