/**
 * Text pools for the seed data. Everything here is invented. It must never contain real
 * people, real employers, identifiable patient or client details, or real-looking health data.
 * Scenarios are generic and written the way members are asked to write them.
 */

export const BIO_SUFFIX = " (Fictional test profile)";

/** Fictional institutions and workplaces. None is meant to resemble a real organization. */
export const SCHOOLS = [
  "Northfield University",
  "Lakeshore College of Health Sciences",
  "Maple Ridge Institute",
  "Harborview University",
  "St. Aldric's College",
  "Cedar Valley Community College",
  "Westmount Polytechnic",
  "Riverbend University",
];

export const WORKPLACES = [
  "Riverbend Health Centre",
  "Pinecrest Community Services",
  "Brightwater Clinic Group",
  "Summit Public Health Unit",
  "Harbourside Family Services",
  "Oakline Rehabilitation Centre",
  "Meadowbrook Care Network",
  "Lantern Youth Services",
];

export const INTERESTS = [
  "Evidence-based practice",
  "Interprofessional teamwork",
  "Health equity",
  "Rural and remote care",
  "Student wellbeing",
  "Community outreach",
  "Knowledge translation",
  "Trauma-informed practice",
  "Digital health",
  "Healthy aging",
  "Child and family wellbeing",
  "Clinical education",
];

export const SKILLS_BY_FIELD: Record<string, string[]> = {
  nursing: ["Patient education", "Care planning", "Team communication", "Time management", "Charting accuracy"],
  medicine: ["Clinical reasoning", "Case presentation", "Evidence appraisal", "Teaching juniors", "Handover"],
  psychology: ["Active listening", "Research methods", "Statistics", "Motivational interviewing", "Report writing"],
  social_work: ["Case management", "Advocacy", "Crisis de-escalation", "Community resources", "Group facilitation"],
  pharmacy: ["Medication review", "Patient counselling", "Evidence appraisal", "Inventory management", "Interprofessional communication"],
  physiotherapy: ["Exercise prescription", "Movement assessment", "Patient coaching", "Goal setting", "Outcome measures"],
  occupational_therapy: ["Activity analysis", "Goal setting", "Home assessment", "Client-centred practice", "Documentation"],
  speech_language_pathology: ["Language assessment", "Parent coaching", "Therapy planning", "Group therapy", "Data collection"],
  audiology: ["Hearing assessment", "Counselling", "Device fitting", "Outcome measurement", "Family education"],
  public_health: ["Program evaluation", "Data analysis", "Health communication", "Community engagement", "Policy review"],
  other: ["Project coordination", "Writing", "Facilitation", "Data entry", "Public speaking"],
};

export const MENTORSHIP_AREAS = [
  "Clinical placements",
  "Career transitions",
  "Graduate school applications",
  "Research methods",
  "Work-life balance",
  "Interview preparation",
  "Leadership early on",
  "Writing and publishing",
  "Starting in a new setting",
  "Study strategies",
];

export const CITIES = [
  "Montreal",
  "Toronto",
  "Vancouver",
  "Calgary",
  "Halifax",
  "Ottawa",
  "Winnipeg",
  "Quebec City",
];

export const TOPICS = [
  "mental health in school settings",
  "rural access to care",
  "stroke rehabilitation",
  "early childhood language",
  "community wellness programs",
  "health literacy",
  "caregiver support",
  "medication safety",
  "interprofessional education",
  "youth mental health",
];

/** Opening and closing flourishes that make repeated post bases read differently. */
export const OPENERS = [
  "",
  "",
  "",
  "Quick thought: ",
  "Been thinking about this all week. ",
  "Curious what others think. ",
  "Sharing in case it helps someone. ",
];

export const CLOSERS = [
  "",
  "",
  " Would love to hear how others handle this.",
  " Thanks in advance!",
  " Happy to share my notes if they would be useful.",
  " Any tips welcome.",
  " Hope this helps someone.",
];

export const EXTRAS = [
  "",
  "",
  "",
  "\n\nFor context, I'm early on in this and still working out what works for me.",
  "\n\nEdit: thank you all, I'm reading every reply.",
  "\n\nPeer perspective only, of course. Please check with your own supervisor or program.",
  "\n\nI'll write up what I end up trying and report back.",
];

export const POST_BASES: Record<string, string[]> = {
  general_discussion: [
    "What's one small habit that has made your workweek calmer? Mine is writing tomorrow's top three tasks before I leave.",
    "Does anyone else find the hardest part of this field is explaining what we actually do to friends and family? How do you describe your work in one sentence?",
    "New here and looking forward to learning from this community. What do you wish you had known in your first month?",
    "Podcast recommendations for the commute? I'd love something on communication or teamwork rather than purely technical content.",
    "Reflective journaling felt awkward at first, but it's what finally made feedback useful for me.",
    "How do you keep in touch with classmates and colleagues after you move to a different city or workplace?",
    "Thank you to everyone who answered my questions last week. It genuinely helped.",
    "What does a good handover look like to you? I'm drafting a checklist for my team and would love ideas.",
    "Anyone else surprised by how much of this work is listening? It's been the biggest shift for me this year.",
    "Weekend question: what do you do to switch off from work? I keep failing at it.",
  ],
  academic_life: [
    "Our study group is trying a new format this term: each person teaches one topic in ten minutes. It's exposing gaps fast, in a good way.",
    "How do you structure revision when you have three exams in one week? I'm trying blocks by topic instead of by course.",
    "Placement paperwork is eating my evenings. Does anyone have a template for tracking learning goals that isn't a nightmare?",
    "Group project dynamics: how do you raise an uneven workload without it getting awkward?",
    "Finished my first literature review draft and realized I'd been summarizing instead of synthesizing. Tips for making the jump?",
    "Presentation anxiety is real. What helped you the most before your first big presentation?",
    "How early did you contact your thesis supervisor to agree on expectations? I'm worried I'm already behind.",
    "Is it just me or does the reading load triple in the second term? Looking for realistic skimming strategies.",
    "Sharing my study schedule template in case it helps. Colour-coding by priority, not by subject, was the change that stuck.",
    "Anyone balancing part-time work with a full course load? How do you protect study time?",
  ],
  career_journey: [
    "Considering a move from a hospital setting into community work. What surprised you most about the transition?",
    "I'm choosing between two offers: one with more mentorship, one with better pay. How did you weigh it at your stage?",
    "Returning to practice after a long break. Any advice on rebuilding confidence in the first few months?",
    "Spent two years in one specialty and I'm not sure it's the right fit. How did you decide whether to stay or pivot?",
    "Lessons from my first rural placement: slower pace, wider scope, and far more phone calls than I expected.",
    "Went to my first conference as a student and felt invisible on day one. Day two went much better. Tips for starting conversations?",
    "Anyone else taking a non-linear path? I started in one field and ended up in another, and it turned out to be an advantage.",
    "How do you find a mentor without it feeling forced? I'd love a natural way to start.",
    "Setback this month: not selected for a program I really wanted. Trying to treat it as information, not a verdict.",
    "Thinking about further study in a few years. Is it worth working first, or going straight through?",
  ],
  professional_advice: [
    "A lesson that took me too long: write notes as if a colleague will read them tomorrow. It improves clarity and saves time.",
    "How do you set boundaries around after-hours messages without seeming unresponsive?",
    "When feedback stings, I wait a day before replying. It almost always changes what I say. What's your approach?",
    "Interprofessional teamwork tip: ask each role what they need from you to do their part well. The answers are often simple.",
    "How do you onboard a new colleague without overwhelming them? I'm trying a one-page 'first month' guide.",
    "Supervision works best when I bring a specific question instead of a general update. What makes it useful for you?",
    "Preventing burnout: for me it's protecting one non-negotiable break each shift. Small, but it adds up.",
    "Negotiating your first salary? Researching ranges and practicing the conversation out loud made a big difference for me.",
    "Time management for busy days: I do the one task I'm dreading first. Not always, but it works more than it fails.",
    "Advocating for yourself can feel uncomfortable. Writing down your wins each month makes it far easier to talk about them.",
  ],
  research_knowledge: [
    "Reading papers efficiently: abstract, figures, then methods, and only then the discussion. Saves me hours.",
    "What reference manager do you use, and why? I'm tired of fixing citations by hand.",
    "Working on a small qualitative project. How do you keep your coding consistent when you're the only coder?",
    "Ethics applications taught me to be precise about consent wording. Anyone have a favourite plain-language template?",
    "Statistics refresher recommendations? I'd like something practical with worked examples rather than pure theory.",
    "Our journal club switched to one person presenting a critique rather than a summary. Discussion quality jumped.",
    "Poster design tip: one clear takeaway, large figures, and fewer words than you think you need.",
    "How do you stay on top of new literature without drowning? I'm trying a weekly reading hour with a fixed list.",
    "Open-access finds of the week: a handful of free, well-written methods guides. Happy to share the list.",
    "How do you decide when a pilot study is 'enough' to justify a bigger one?",
  ],
  personal_achievement: [
    "Passed my final exam today. Relieved, tired, and so grateful to my study group.",
    "Finished my last clinical placement of the term. I learned more than I thought possible in eight weeks.",
    "Gave my first conference talk this week. Shaking hands, but it went well, and the questions were kind.",
    "Thesis proposal approved! Now the real work begins.",
    "Hit a volunteering milestone: one year of weekly shifts at a community programme.",
    "Completed a short course I'd been putting off for months. Small step, big confidence boost.",
    "Got accepted to the programme I applied for. Still processing. Thank you to everyone who read my application drafts.",
    "Mentored a first-year student for the first time today. I got as much from it as they did.",
    "Made it through a really hard semester. Not graceful, but done.",
    "Submitted my first paper for review. Whatever happens, I'm proud I finished it.",
  ],
  questions: [
    "Generic question for educators: how do you give feedback on reflective writing without making it feel like grading?",
    "How do you prepare for a first day on placement when you don't yet know the team?",
    "For those who've done a research placement: what would you do differently in the first two weeks?",
    "Looking for study resources on communication skills for difficult conversations. Books, courses or workshops welcome.",
    "How do you handle a supervisor who is very busy and hard to reach? I want to ask for support without being a burden.",
    "What's a reasonable way to track my hours and learning goals across several placements?",
    "Do you have advice for moving from student to colleague mindset in your first role?",
    "How do you decide which professional association to join first? There are so many options.",
    "How do you stay current with guidelines in a field that changes quickly?",
    "For people working across disciplines: what's one thing you wish your colleagues in other roles understood about yours?",
    "What are your favourite ways to practise explaining complex ideas in plain language?",
    "If you could give one piece of advice to someone starting this programme next year, what would it be?",
  ],
};

export const QUESTION_NOTE =
  "\n\n(Generic scenario, no identifying details. Please don't share any about real people.)";

export const COMMENTS = [
  "Congratulations, that's a real milestone!",
  "This is exactly what helped me too. Thanks for sharing.",
  "Great question. I'd start with your program's student services; they often have templates.",
  "Thank you for posting this, it's reassuring to hear others feel the same.",
  "I'd add one thing: ask your supervisor early what a good week looks like.",
  "Love this. Saving it for the next term.",
  "Same here! Happy to compare notes if you like.",
  "That tip about writing notes for a colleague is gold.",
  "Rooting for you. Setbacks like this are more common than they look from the outside.",
  "I tried something similar and it worked better than I expected.",
  "Have you tried a short check-in at the start of the week? It changed how my team communicates.",
  "Really useful, thank you.",
  "I wish I had known this in my first year.",
  "Sending encouragement, you've got this!",
  "Good point about boundaries. It took me a while to learn that too.",
  "I'd love to see the checklist when it's ready.",
  "Same experience on my side; the second week gets easier.",
  "Thanks for the honest post. It takes courage to share a setback.",
  "A colleague recommended the same approach and I've been using it since.",
  "Interesting perspective, I hadn't thought of it that way.",
  "That's a fair concern. Maybe raise it in a calm, scheduled conversation?",
  "Well done! Enjoy the break you've earned.",
  "Peer opinion only, but I'd choose the role with more mentorship at your stage.",
  "For what it's worth, plain-language summaries helped me a lot when I was starting out.",
  "Following this thread. I'm facing the same decision.",
  "Brilliant, thanks for taking the time to explain.",
  "Agree completely. Small consistent habits beat big plans.",
  "I'd suggest reaching out to someone one step ahead of you; they remember the details best.",
  "This made my day. Thank you!",
  "We tried this in our group and it was surprisingly effective.",
  "Honest question: what would you do differently if you started again?",
  "Seconding the journaling suggestion. Even five minutes helps.",
  "Good luck with the next steps, keep us posted!",
  "Great reminder to ask for feedback early rather than late.",
  "Thanks for the encouragement; I needed it today.",
  "A calendar block for admin work saved my evenings.",
];

/** Posts with characters that must be escaped when rendered. Rendered as text, never as markup. */
export const ESCAPING_POSTS: { category: string; body: string }[] = [
  {
    category: "research_knowledge",
    body: "Formatting reminder for lab notes: write conditions like \"if x < 5 && y > 3\" in full words in your report, and watch out for symbols such as <, > and & when copying between tools. 🧪",
  },
  {
    category: "general_discussion",
    body: "Testing how this renders: <b>not bold</b> and <script>alert('hi')</script> should appear as plain text, never as formatting. 'Single quotes', \"double quotes\" and an ampersand: Tom & Jerry. 😊",
  },
  {
    category: "personal_achievement",
    body: "Small win 🎉 I finally understood p < 0.05 isn't the whole story! Effect sizes & confidence intervals matter too.",
  },
  {
    category: "professional_advice",
    body: "Tip: keep a 'wins' file 📝 and a 'questions' file ❓. Review both before supervision. (No names, no details, just themes.)",
  },
  {
    category: "questions",
    body: "Does anyone have a good mnemonic for remembering when to use <, ≤, > and ≥ in inclusion criteria? I always mix them up. 🤔" + "\n\n(Generic scenario, no identifying details. Please don't share any about real people.)",
  },
];

export const LONG_SENTENCES = [
  "I have been reflecting on how much of my growth this year came from small, repeated habits rather than big breakthroughs.",
  "When I started, I believed I needed to have every answer ready, and it took months to see that good questions matter more.",
  "My supervisor once told me that confidence grows from preparation, and I have found that to be mostly true.",
  "Peer support has been the quiet backbone of my training: study partners, placement buddies and the occasional late-night message.",
  "I try to end each week by writing three things that went well, one thing I would change, and one person I want to thank.",
  "None of this is professional advice, just what has worked for me, and I would genuinely like to hear what has worked for you.",
  "Boundaries were the hardest skill to learn, because they felt like saying no to people I wanted to help.",
  "Over time I learned that sustainable effort beats heroic effort, and that rest is part of the work rather than a reward for it.",
  "If you are earlier in your journey than I am, please know that feeling lost for a while is normal and it does pass.",
  "If you are further along, I would love to learn how you stayed curious and kind through the long middle stretch of a career.",
];
