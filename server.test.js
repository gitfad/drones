import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { v4 as uuidv4 } from 'uuid';
const API = require('./api.js')
const Routes = require('./routes.js')
const Drone = require('./models/drone.js')

let api
let port
let base

beforeAll(async () => {
    api = await API.create({ testingMode: true })
    await api.listen()
    port = api.server.address().port
    base = path => `http://localhost:${port}${path}`
})

afterAll(async () => {
    await api.close()
})

const initialDroneData = { serialNumber: uuidv4(), model: Drone.MODEL_TYPES[0], batteryLevel: 60 }

describe('swagger', () => {
    test('should respond Swagger UI', async () => {
        const response = await fetch(base('/docs'), { method: "GET" })
        expect(await response.text()).toContain('Swagger UI')
    })
})

describe('drone', () => {
    test('should fail the drone registration with 101 chars serial number', async () => {
        const droneData = { ...initialDroneData, serialNumber: 'a'.repeat(101) }

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
        const droneData = { ...initialDroneData, model: 'invalidModel' }

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
        const droneData = { ...initialDroneData, batteryLevel: 150 }

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
        const droneData = { ...initialDroneData, serialNumber: 'a1a1a1a1a1' }

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
        const response = await fetch(base(Routes.DRONES_PATH), {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(initialDroneData)
        })
        expect(response.status).toBe(200)

        const jsonResponse = await response.json()
        expect(jsonResponse).toBeTruthy()
        expect(jsonResponse.serialNumber).toBe(initialDroneData.serialNumber)
        expect(jsonResponse.model).toBe(initialDroneData.model)
        expect(jsonResponse.batteryLevel).toBe(initialDroneData.batteryLevel)
        expect(jsonResponse.state).toBe(Drone.STATE_IDLE_TYPE)
        expect(jsonResponse.weightLimit).toBeGreaterThan(0)
    })

    test('should get available drones for loading', async () => {
        expect(undefined).toBeTruthy()
    })

    test('should get available drones for loading excluding drones with battery level below 25%', async () => {
        expect(undefined).toBeTruthy()
    })
    
    test('should fail getting the battery level from an unregistered drone', async () => {
        expect(undefined).toBeTruthy()
    })
    
    test('should get the battery level from a drone', async () => {
        expect(undefined).toBeTruthy()
    })
})

describe('medical items', () => {
    test('should fail loading a drone with an invalid medical item name', async () => {
        expect(undefined).toBeTruthy()
    })

    test('should fail loading a drone with an invalid medical item weight', async () => {
        expect(undefined).toBeTruthy()
    })

    test('should fail loading a drone with an invalid medical item code', async () => {
        expect(undefined).toBeTruthy()
    })

    test('should fail loading a drone with an invalid medical item imageBase64', async () => {
        expect(undefined).toBeTruthy()
    })

    test('should fail loading a drone with more medical items weight than it supports', async () => {
        expect(undefined).toBeTruthy()
    })

    test('should fail loading a drone with medical items when it has battery level below 25%', async () => {
        expect(undefined).toBeTruthy()
    })

    test('should load a drone with medical items', async () => {
        expect(undefined).toBeTruthy()
    })

    test('should fail getting the medical items from an unregistered drone', async () => {
        expect(undefined).toBeTruthy()
    })

    test('should get the medical items from an empty drone', async () => {
        expect(undefined).toBeTruthy()
    })

    test('should get the medical items from a loaded drone', async () => {
        expect(undefined).toBeTruthy()
    })
})