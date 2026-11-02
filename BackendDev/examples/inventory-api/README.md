# Inventory API

## What this backend does
Manage products and stock levels

## Learn the request flow
A client sends an HTTP request → the server matches a route → a handler applies logic to data → the server returns a status and JSON response.

## Starter routes
- GET /health — check that the API is running
- GET /products — list all records
- POST /products — create a record using a JSON body
- GET /products/1 — read one record
- PUT or PATCH /products/1 — update a record
- DELETE /products/1 — delete a record

## Run and test
Open this project in BackendDev. Choose Run API server, then try http://127.0.0.1:3000/health in the API tester. Choose Run tests to check the starter. Records are in memory and reset when the server stops. Connect a database before using real data.
