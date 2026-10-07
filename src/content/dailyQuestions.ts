import { dayOfYear } from '../domain/dates';

/** Prioritisation, reflection, clarity, perspective. One per day, never a quote. */
export const DAILY_QUESTIONS: string[] = [
  'If only one thing moved forward today, what would make this day worthwhile?',
  'What are you avoiding that, once done, would make everything else lighter?',
  'Which commitment are you carrying that no longer deserves your energy?',
  'What would you do today if you trusted that the small things would sort themselves out?',
  'Who is waiting on you, and what is the smallest useful thing you could send them?',
  'What decision are you postponing, and what do you already know about it?',
  'What does “done well enough” look like for the thing you are polishing?',
  'Where did your attention go yesterday, and was that where you wanted it?',
  'What is the one conversation that would change the shape of this week?',
  'If you had to cancel half of today, what would you protect?',
  'What would future you thank you for starting today?',
  'Which of your open loops is actually someone else’s to close?',
  'What did you learn this week that should change how you work next week?',
  'What is the real reason the hardest task on your list is still there?',
  'Where are you being busy instead of being effective?',
  'What would make today feel calm rather than full?',
  'What is one thing you can stop doing without anyone noticing?',
  'Which result matters more to you than how it looks?',
  'What would you tackle first if you had only two good hours today?',
  'What are you waiting for permission to do?',
  'Which relationship deserves more of your attention than it is getting?',
  'What is the cheapest experiment that would settle an open question?',
  'What did you say yes to recently that you should revisit?',
  'If this week went perfectly, what would be true by Friday?',
  'What is the next step so small that you cannot reasonably postpone it?',
  'What are you certain about that you have not checked lately?',
  'Which task are you treating as urgent that is merely loud?',
  'What would you like to be able to say about today when it ends?',
  'Where could you ask for help and save yourself a week?',
  'What have you been carrying in your head that belongs on paper?',
];

/** Deterministic: the same question all day, a different one tomorrow. */
export function questionFor(date: Date): string {
  return DAILY_QUESTIONS[dayOfYear(date) % DAILY_QUESTIONS.length];
}
