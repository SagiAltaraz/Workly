# frontend

React + TypeScript + Vite. אפליקציית עמוד אחד (בלי router), RTL, CSS עם תכונות לוגיות (`inline-start`, `inset-inline-end`…).

```
api/         קריאות לשרת וקריאת זרם ההתקדמות (SSE)
context/     AppContext: workspace + פתיחת חלון מקור / עריכה
hooks/       useWorkspace (המצב והפעולות), useClock
components/  לפי פיצ'ר: chat, board, calendar, brief, questions, layout, common
utils/       חישובי תצוגה בלבד: לוח חודשי, מיון כרטיסים, ייצוא .ics
types/       עותק של טיפוסי השרת (npm run sync:types)
```

השרת הוא זה שמחשב תאריכים, שעות, עדיפויות והדגשות. הפרונט רק מציג ומסדר.
