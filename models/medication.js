const Drone = require('./drone')

const initialize = async (sqlite) => {
    await sqlite.run("CREATE TABLE IF NOT EXISTS Medications ( droneSerialNumber varchar NOT NULL, code varchar NOT NULL, name varchar NOT NULL, weight int, imageBase64 varchar, PRIMARY KEY (droneSerialNumber, code))")
}

const cleanUp = async (sqlite) => {
    await sqlite.run("DELETE FROM Medications")
}

const getDroneLoadWeight = async (sqlite, droneSerialNumber) => {
    const result = await sqlite.get("SELECT SUM(weight) as sumWeight FROM Medications WHERE droneSerialNumber = $droneSerialNumber", { "$droneSerialNumber": droneSerialNumber })
    return result.sumWeight === null? 0 : result.sumWeight
}

const getDroneLoad = async (sqlite, droneSerialNumber) => {
    let drone = await Drone.get(sqlite, droneSerialNumber)
    if (drone === undefined) {
        throw new Error('drone didn\'t exists')
    }

    return sqlite.all("SELECT code, name, weight, imageBase64 FROM Medications WHERE droneSerialNumber = $droneSerialNumber", { "$droneSerialNumber": droneSerialNumber })
}

const validateItem = (code, name, weight, imageBase64) => {
    if (typeof code !== 'string') {
        throw new Error('code string field required')
    } else if (!/^[A-Z0-9_]*$/gm.test(code)) {
        throw new Error('invalid code field value')
    } else if (typeof name !== 'string') {
        throw new Error('name string field required')
    } else if (!/^[a-zA-Z0-9_-]*$/gm.test(name)) {
        throw new Error('invalid name field value')
    } else if (typeof weight !== 'number') {
        throw new Error('weight number field required')
    } else if (weight > Drone.MAXIMUM_WEIGHT_LIMIT) {
        throw new Error('invalid weight field value')
    } else if (typeof imageBase64 !== 'string') {
        throw new Error('imageBase64 string field required')
    } else if (!imageBase64.startsWith('data:')) {
        throw new Error('invalid imageBase64 field value')
    }
}

const loadDrone = async (sqlite, droneSerialNumber, medicationItems) => {
    if (typeof medicationItems !== 'object' || medicationItems.length === 0) {
        throw new Error('medicationItems array field required')
    }

    let drone = await Drone.get(sqlite, droneSerialNumber)
    if (drone === undefined) {
        throw new Error('drone didn\'t exists')
    } else if (drone.state === Drone.STATE_LOADING_TYPE) {
        throw new Error('drone already in loading state')
    }
    await Drone.setState(sqlite, drone, Drone.STATE_LOADING_TYPE)

    try {
        let currentWeight = await getDroneLoadWeight(sqlite, drone.serialNumber)

        medicationItems.forEach(item => {
            const { code, name, weight, imageBase64 } = item
            validateItem(code, name, weight, imageBase64)

            currentWeight += weight
            if (currentWeight > drone.weightLimit) {
                throw new Error('drone weight limit reached')
            }
        })

        for (let idx = 0; idx < medicationItems.length; idx++) {
            const { code, name, weight, imageBase64 } = medicationItems[idx]

            const insertedResult = await sqlite.run("INSERT INTO Medications (droneSerialNumber, code, name, weight, imageBase64) VALUES ($droneSerialNumber, $code, $name, $weight, $imageBase64)", {
                "$droneSerialNumber": drone.serialNumber,
                "$code": code,
                "$name": name,
                "$weight": weight,
                "$imageBase64": imageBase64
            })

            if (insertedResult.changes === 0) {
                throw new Error('medication couln\'t be added')
            }
        }

        return await getDroneLoad(sqlite, drone.serialNumber)
    } catch (err) {
        throw err
    } finally {
        await Drone.setState(sqlite, drone, Drone.STATE_LOADED_TYPE)
    }
}

module.exports = {
    initialize,
    cleanUp,
    loadDrone,
    getDroneLoad,
}