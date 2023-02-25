const Drone = require('./drone')

const MEDICATION_CODE_REGEX = /^[A-Z0-9_]*$/gm
const MEDICATION_NAME_REGEX = /^[a-zA-Z0-9_-]*$/gm

const initialize = async (sqlite) => {
    await sqlite.run("CREATE TABLE IF NOT EXISTS Medications ( droneSerialNumber varchar NOT NULL, code varchar NOT NULL, name varchar NOT NULL, weight int, imageBase64 varchar, PRIMARY KEY (droneSerialNumber, code))")
}

const getDroneLoadWeight = (sqlite, droneSerialNumber) => {
    return sqlite.get("SELECT SUM(weight) FROM Drones WHERE droneSerialNumber = $droneSerialNumber", { "$droneSerialNumber": droneSerialNumber })
}

const getDroneLoad = (sqlite, droneSerialNumber) => {
    return sqlite.all("SELECT code, name, weight, imageBase64 FROM Medications WHERE droneSerialNumber = $droneSerialNumber", { "$droneSerialNumber": droneSerialNumber })
}

const validateItem = (code, name, weight, imageBase64) => {
    if (typeof code !== 'string') {
        throw new Error('code string field required')
    } else if (!MEDICATION_CODE_REGEX.test(code)) {
        throw new Error('invalid code field value')
    } else if (typeof name !== 'string') {
        throw new Error('name string field required')
    } else if (!MEDICATION_NAME_REGEX.test(name)) {
        throw new Error('invalid name field value')
    } else if (typeof weight !== 'number') {
        throw new Error('weight number field required')
    } else if (typeof imageBase64 !== 'string') {
        throw new Error('imageBase64 string field required')
    }
}

const loadDrone = async (sqlite, droneSerialNumber, medicationItems) => {
    if (typeof medicationItems !== 'array') {
        throw new Error('medicationItems array field required')
    }

    let drone = await Drone.get(sqlite, droneSerialNumber)
    if (drone === undefined) {
        throw new Error('drone didn\'t exists')
    } else if (drone.state === STATE_LOADING_TYPE) {
        throw new Error('drone already in loading state')
    }
    await Drone.setState(sqlite, drone, STATE_LOADING_TYPE)

    try {
        const currentWeight = await getDroneLoadWeight(sqlite, droneSerialNumber)
        console.log('currentWeight', currentWeight)

        medicationItems.forEach(item => {
            const { code, name, weight, imageBase64 } = item
            validateItem(code, name, weight, imageBase64)

            currentWeight += weight
            if (currentWeight > drone.weightLimit) {
                throw new Error('drone weight limit reached')
            }
        })

        medicationItems.forEach(async item => {
            const { code, name, weight, imageBase64 } = item

            const insertedResult = await sqlite.run("INSERT INTO Medications (droneSerialNumber, code, name, weight, imageBase64) VALUES ($droneSerialNumber, $code, $name, $weight, $imageBase64)", {
                "$droneSerialNumber": drone,
                "$code": code,
                "$name": name,
                "$weight": weight,
                "$imageBase64": imageBase64
            })

            if (insertedResult.changes === 0) {
                throw new Error('medication couln\'t be added')
            }
        });

        return await getDroneLoad(sqlite, drone.serialNumber)
    } catch (err) {
        throw err
    } finally {
        await Drone.setState(sqlite, drone, STATE_LOADED_TYPE)
    }
}

module.exports = {
    initialize,
    loadDrone,
    getDroneLoad,
}