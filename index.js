const express = require('express')
const app = express()
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
app.use(express.json())
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server is running at http://localhost:3000')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`
  const getUser = await db.get(getUserQuery)
  if (getUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const checkPassword = await bcrypt.compare(password, getUser.password)
    if (checkPassword === true) {
      const payload = {username: username}
      const jwtToken = await jwt.sign(payload, 'VVIT')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

const authentication = async (request, response, next) => {
  let jwtToken = null
  const auth = request.headers['authorization']
  if (auth !== undefined) {
    jwtToken = auth.split(' ')[1]
  }
  if (jwtToken === null) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    await jwt.verify(jwtToken, 'VVIT', (error, user) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.get('/states/', authentication, async (request, response) => {
  const getStatesQuery = `SELECT state_id AS stateId,state_name AS stateName,population AS population FROM state ;`
  const statesArray = await db.all(getStatesQuery)
  response.send(statesArray)
})

app.get('/states/:stateId/', authentication, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `SELECT state_id AS stateId,state_name AS stateName,population AS population FROM state WHERE state_id=${stateId};`
  const getState = await db.get(getStateQuery)
  response.send(getState)
})

app.post('/districts/', authentication, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const insertDistrictQuery = `INSERT INTO district(district_name,state_id,cases,cured,active,deaths) 
  VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths}); `
  await db.run(insertDistrictQuery)
  response.send('District Successfully Added')
})

app.get(
  '/districts/:districtId/',
  authentication,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictQuery = `SELECT district_id AS districtId,district_name AS districtName,state_id AS stateId,cases AS cases,cured AS cured,active AS active,deaths AS deaths FROM district WHERE district_id = ${districtId};`
    const getDistrict = await db.get(getDistrictQuery)
    response.send(getDistrict)
  },
)

app.delete(
  '/districts/:districtId/',
  authentication,
  async (request, response) => {
    const {districtId} = request.params
    const deleteQuery = `DELETE FROM district WHERE district_id=${districtId};`
    await db.all(deleteQuery)
    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId/',
  authentication,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateDistrictQuery = `UPDATE district SET 
    district_name ='${districtName}' ,
    state_id=${stateId},
    cases=${cases},
    cured=${cured},
    active=${active},
    deaths=${deaths} 
    WHERE district_id = ${districtId};`
    await db.run(updateDistrictQuery)
    response.send('District Details Updated')
  },
)

app.get(
  '/states/:stateId/stats/',
  authentication,
  async (request, response) => {
    const {stateId} = request.params
    const getStatisticsQuery = `SELECT SUM(cases) AS totalCases,SUM(cured) AS totalCured,SUM(active) AS totalActive,SUM(deaths) AS totalDeaths FROM district WHERE state_id=${stateId};`
    const getStatistics = await db.get(getStatisticsQuery)
    response.send(getStatistics)
  },
)

module.exports = app
