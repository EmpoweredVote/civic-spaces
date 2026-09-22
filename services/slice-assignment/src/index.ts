import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { verifyToken } from './middleware/verifyToken'
import assignmentRouter from './routes/assignment'

const app = express()
app.use(cors({ origin: 'https://civicspaces.empowered.vote' }))
app.use(express.json())

// Health check BEFORE auth middleware
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.use(verifyToken)
app.use(assignmentRouter)

const port = process.env.PORT || 3001
app.listen(port, () => {
  console.log(`Slice assignment service listening on port ${port}`)
})
