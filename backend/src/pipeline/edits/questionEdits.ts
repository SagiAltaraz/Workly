import { NotFoundError, ValidationError } from '../../errors'
import type { Workspace } from '../../types/workspace'
import { recompute } from '../recompute'
import type { Change } from './change'

// "Ignore this question". A contradiction cannot be ignored, only answered.
export function dismissQuestion(workspace: Workspace, questionId: string): Change {
  const question = workspace.questions.find((item) => item.id === questionId)
  if (!question) throw new NotFoundError('השאלה לא נמצאה')
  if (question.kind === 'contradiction') throw new ValidationError('סתירה אי אפשר להתעלם ממנה, צריך לבחור ערך')
  return {
    workspace: recompute({ ...workspace, dismissedQuestionIds: [...workspace.dismissedQuestionIds, questionId] }),
    label: `הוסתרה שאלה: ${question.text}`,
  }
}
