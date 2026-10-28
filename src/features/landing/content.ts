import {
  Compass,
  FlaskConical,
  HeartHandshake,
  MapPin,
  MessagesSquare,
  PenLine,
  Users,
  Briefcase,
  type LucideIcon,
} from "lucide-react";

export type Feature = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

export const features: Feature[] = [
  {
    id: "networking",
    title: "Professional Networking",
    description:
      "Build a profile around your education, experience, skills and certifications, then connect with peers, professors, researchers and employers.",
    icon: Users,
  },
  {
    id: "mentorship-feature",
    title: "Mentorship",
    description:
      "Find a mentor by profession, interests and availability, or offer your experience to someone just starting out.",
    icon: Compass,
  },
  {
    id: "forums",
    title: "Discussion Forums",
    description:
      "Ask about placements, programs and practice. Answers come from students, mentors and verified professionals.",
    icon: MessagesSquare,
  },
  {
    id: "stories",
    title: "Personal Stories",
    description:
      "Share a first placement, a hard exam, a career change. Celebrate the milestones, and the lessons that came with them.",
    icon: PenLine,
  },
  {
    id: "research",
    title: "Research and Knowledge Sharing",
    description:
      "Publish articles, follow topics and discuss credible sources across disciplines, with evidence and transparency first.",
    icon: FlaskConical,
  },
  {
    id: "careers",
    title: "Careers and Opportunities",
    description:
      "From internships and placements to leadership roles, with verified employers and alerts matched to your goals.",
    icon: Briefcase,
  },
  {
    id: "nearby",
    title: "Nearby Communities",
    description:
      "Find study groups, meetups and events in your city. Location is optional and your exact whereabouts are never shown.",
    icon: MapPin,
  },
  {
    id: "support",
    title: "Mental Health and Peer Support",
    description:
      "A space to be heard, with anonymous options, peer communities and clearly marked crisis resources for when it matters.",
    icon: HeartHandshake,
  },
];

export const stages = [
  {
    label: "Students",
    text: "Find direction early: programs, placements, study groups and people who have been there.",
  },
  {
    label: "Recent graduates",
    text: "Land a first role, prepare for licensing and build confidence with guidance on hand.",
  },
  {
    label: "Professionals",
    text: "Grow your network, specialise, and stay connected to peers in and beyond your discipline.",
  },
  {
    label: "Mentors",
    text: "Pass on what you know through one-on-one conversations or small group sessions.",
  },
  {
    label: "Researchers",
    text: "Share findings, start discussions and reach the practitioners who put evidence to work.",
  },
] as const;

export const disciplines = [
  "Nursing",
  "Medicine",
  "Psychology",
  "Social Work",
  "Pharmacy",
  "Physiotherapy",
  "Occupational Therapy",
  "Speech-Language Pathology",
  "Audiology",
  "Public Health",
] as const;

export const mentorshipPoints = [
  "Understand the range of healthcare and social services careers",
  "Get through programs, internships and professional licensing",
  "Prepare for interviews, placements and a first role",
  "Build professional confidence with one-on-one guidance",
] as const;
