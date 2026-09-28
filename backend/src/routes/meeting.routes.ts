import { Router } from 'express'
import { createMeeting, removeMeeting, reviveMeeting, updateMeeting } from '../controllers/meeting.controller'

const router = Router({ mergeParams: true })

router.post('/', createMeeting)
router.patch('/:meetingId', updateMeeting)
router.delete('/:meetingId', removeMeeting)
router.post('/:meetingId/restore', reviveMeeting)

export default router
