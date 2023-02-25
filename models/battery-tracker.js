
const initialize = async (sqlite) => {
    await sqlite.run("CREATE TABLE IF NOT EXISTS BatteriesTracking ( serialNumber varchar(100), batteryLevel int, timestamp DATE DEFAULT (datetime('now','localtime')) )")
}

const cleanUp = async (sqlite) => {
    await sqlite.run("DELETE FROM BatteriesTracking")
}

const track = async (sqlite, serialNumber, currentBatteryLevel) => {
    const insertedResult = await sqlite.run("INSERT INTO BatteriesTracking (serialNumber, batteryLevel) VALUES ($serialNumber, $batteryLevel)", {
        "$serialNumber": serialNumber,
        "$batteryLevel": currentBatteryLevel
    })
    if (insertedResult.changes === 0) {
        throw new Error('battery level tracking insert failed')
    }
}

const getTrackedDrone = async (sqlite, serialNumber) => {
    const results = await sqlite.all("SELECT timestamp, batteryLevel FROM BatteriesTracking WHERE serialNumber = $serialNumber ORDER BY timestamp DESC", 
    {  "$serialNumber": serialNumber })
    return results.map(item => ({ level: item.batteryLevel, timestamp: item.timestamp }))
}

module.exports = {
    initialize,
    cleanUp,
    track,
    getTrackedDrone
}