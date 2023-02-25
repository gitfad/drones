const BatteryTracker = require('./battery-tracker')

const MODEL_LIGHT_TYPE = 'Lightweight'
const MODEL_MIDDLE_TYPE = 'Middleweight'
const MODEL_CRUISER_TYPE = 'Cruiserweight'
const MODEL_HEAVY_TYPE = 'Heavyweight'
const MODEL_TYPES = [MODEL_LIGHT_TYPE, MODEL_MIDDLE_TYPE, MODEL_CRUISER_TYPE, MODEL_HEAVY_TYPE]
const MODEL_WEIGHTS = new Map([[MODEL_LIGHT_TYPE, 100], [MODEL_MIDDLE_TYPE, 200], [MODEL_CRUISER_TYPE, 300], [MODEL_HEAVY_TYPE, 500]])

const STATE_IDLE_TYPE = 'IDLE'
const STATE_LOADING_TYPE = 'LOADING'
const STATE_LOADED_TYPE = 'LOADED'
const STATE_DELIVERING_TYPE = 'DELIVERING'
const STATE_DELIVERED_TYPE = 'DELIVERED'
const STATE_RETURNING_TYPE = 'RETURNING'
const STATE_TYPES = [STATE_IDLE_TYPE, STATE_LOADING_TYPE, STATE_LOADED_TYPE, STATE_DELIVERING_TYPE, STATE_DELIVERED_TYPE, STATE_RETURNING_TYPE]

const MAXIMUM_BATTERY_CAPACITY = 100
const MAXIMUM_SERIAL_NUMBER_LENGTH = 100
const MAXIMUM_WEIGHT_LIMIT = 500
const FAKE_BATTERY_LEVEL_DISCHARGE = 1 // 1% less every check

const initialize = async (sqlite) => {
    await sqlite.run("CREATE TABLE IF NOT EXISTS Drones( serialNumber varchar(100) PRIMARY KEY, model varchar(15) NOT NULL, weightLimit int, batteryLevel int, state varchar(10) NOT NULL)")
}

const cleanUp = async (sqlite) => {
    await sqlite.run("DELETE FROM Drones")
}

const checkBatteriesLevel = async (sqlite) => {
    const results = await sqlite.all("SELECT serialNumber, batteryLevel FROM Drones WHERE batteryLevel > 0", {})
    for (let idx = 0; idx < results.length; idx++) {
        const { serialNumber, batteryLevel } = results[idx]
        const currentBatteryLevel = batteryLevel - FAKE_BATTERY_LEVEL_DISCHARGE

        const updatedResult = await sqlite.run("UPDATE Drones SET batteryLevel = $batteryLevel WHERE serialNumber = $serialNumber", {
            "$serialNumber": serialNumber,
            "$batteryLevel": currentBatteryLevel
        })
        if (updatedResult.changes === 0) {
            throw new Error('drone battery level update failed')
        }

        await BatteryTracker.track(sqlite, serialNumber, currentBatteryLevel)
    }
}

const setState = async (sqlite, drone, state) => {
    const updatedResult = await sqlite.run("UPDATE Drones SET state = $state WHERE serialNumber = $serialNumber AND batteryLevel >= $minimumBattery", {
        "$serialNumber": drone.serialNumber,
        "$state": state,
        "$minimumBattery": (state === STATE_LOADING_TYPE ? 25 : 0)
    })

    if (updatedResult.changes === 0) {
        throw new Error('drone without enough battery level')
    }
}

const get = (sqlite, serialNumber) => {
    return sqlite.get("SELECT serialNumber, model, weightLimit, batteryLevel, state FROM Drones WHERE serialNumber = $serialNumber", { "$serialNumber": serialNumber })
}

const getAllLoadingAvailability = (sqlite) => {
    return sqlite.all("SELECT serialNumber, model, weightLimit, batteryLevel, state FROM Drones WHERE state = $state AND batteryLevel >= $minimumBattery", {
        "$state": STATE_IDLE_TYPE,
        "$minimumBattery": 25
    })
}

const register = async (sqlite, serialNumber, model, batteryLevel) => {
    if (typeof serialNumber !== 'string') {
        throw new Error('serialNumber string field required')
    } else if (serialNumber.length > MAXIMUM_SERIAL_NUMBER_LENGTH) {
        throw new Error('maximum serialNumber length reached')
    } else if (typeof model !== 'string') {
        throw new Error('model string field required')
    } else if (!MODEL_TYPES.includes(model)) {
        throw new Error('invalid model field value')
    } else if (typeof batteryLevel !== 'number') {
        throw new Error('batteryLevel number field required')
    } else if (batteryLevel > MAXIMUM_BATTERY_CAPACITY || batteryLevel < 0) {
        throw new Error('invalid batteryLevel field value')
    }

    const weightLimit = MODEL_WEIGHTS.get(model), state = STATE_IDLE_TYPE
    try {
        const insertedResult = await sqlite.run("INSERT INTO Drones (serialNumber, model, weightLimit, batteryLevel, state) VALUES ($serialNumber, $model, $weightLimit, $batteryLevel, $state)", {
            "$serialNumber": serialNumber,
            "$model": model,
            "$weightLimit": weightLimit,
            "$batteryLevel": batteryLevel,
            "$state": state
        })

        if (insertedResult.changes === 0) {
            throw new Error('drone couln\'t be registered')
        } else {
            return await get(sqlite, serialNumber)
        }
    } catch (err) {
        if (err.message.startsWith("SQLITE_CONSTRAINT: UNIQUE constraint failed")) {
            throw new Error('drone already exists')
        } else {
            throw err
        }
    }
}

module.exports = {
    MODEL_TYPES,
    MODEL_HEAVY_TYPE,
    STATE_TYPES,
    STATE_IDLE_TYPE,
    STATE_LOADING_TYPE,
    STATE_LOADED_TYPE,
    MAXIMUM_SERIAL_NUMBER_LENGTH,
    MAXIMUM_WEIGHT_LIMIT,
    MAXIMUM_BATTERY_CAPACITY,
    initialize,
    cleanUp,
    checkBatteriesLevel,
    get,
    getAllLoadingAvailability,
    register,
    setState,
}