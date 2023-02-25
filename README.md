# Drones REST API

## Tech stack
NodeJS + Fastify + SQLite + Swagger + SwaggerUI + Vitest + Toad-scheduler

## Requirements
node v19.1.0 + pnpm v7.18.0 or npm 8.19.3

## Installation 
```
pnpm i
```

## Tests
```
pnpm run test
```

## Running
```
pnpm run start
```
The database is in-memory, it starts without data ready to receive drone registrations. Remember every change will be lost when the server is stopped.

With the server running, you can access the swagger API docs: [REST API Documentation](http://localhost:3000/docs).

## API Curl examples
Registering a drone:
```
curl --header "Content-Type: application/json" --request POST --data '{"serialNumber": "1a1a1a1a", "model": "Middleweight", "batteryLevel": 60 }' http://localhost:3000/drones
```

Getting the current battery level (includes the tracked history too) from a registered drone:
```
curl --header "Content-Type: application/json" --request GET http://localhost:3000/drones/1a1a1a1a/battery-level
```

Getting medication items from a registered drone:
```
curl --header "Content-Type: application/json" --request GET http://localhost:3000/drones/1a1a1a1a/medication-items
```

Getting available registered drones to load more medication items:
```
curl --header "Content-Type: application/json" --request GET http://localhost:3000/drones/availability/loading
```

## Tasks
The periodic task run every 60 seconds, it checks each drone with remaining battery and fake the battery draining reducing it by 1% each time.
