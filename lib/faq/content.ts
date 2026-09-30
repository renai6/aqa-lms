export type FaqItem = {
  question: string
  /** One entry per paragraph. */
  answer: string[]
}

export type FaqCategory = {
  /** Used as the section's anchor on the page. */
  id: string
  title: string
  items: FaqItem[]
}

// Answers mirror the student handbook, so keep the two in step.
export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    items: [
      {
        question: 'How do I create an account?',
        answer: [
          'Open the login page and click Create an account, or pick a program first and the site takes you there on its own.',
          'Fill in your name, email address, password and contact details, then click Create account. You are signed in straight away.',
        ],
      },
      {
        question: 'Do I have to wait for approval before I can log in?',
        answer: [
          'No. Your account works from the moment you register, so you can log in and look around right away.',
          'Only your enrollment in a program waits for an admin to approve it.',
        ],
      },
      {
        question: 'What is the difference between a New Student and an Old Student?',
        answer: [
          'Choose New Student if this is your first time studying with Al-Qur\'an Academy.',
          'Choose Old Student if you have studied with us before.',
        ],
      },
      {
        question: 'I forgot my password. How do I reset it?',
        answer: [
          'Click Forgot password? on the login page and follow the instructions sent to your email.',
          'If the email does not arrive, check your spam folder.',
        ],
      },
    ],
  },
  {
    id: 'enrollment',
    title: 'Enrollment',
    items: [
      {
        question: 'How do I enroll in a program?',
        answer: [
          'Open Courses, tick the programs you want, and click Proceed to payment.',
          'Send your payment with a proof of payment, or choose to pay later, then submit. An admin reviews the request and approves your enrollment.',
        ],
      },
      {
        question: 'Can I enroll in more than one program at a time?',
        answer: [
          'Yes. Tick every program you want before you click Proceed to payment and they are submitted together as one request.',
        ],
      },
      {
        question: 'What is the difference between On-Site and Online programs?',
        answer: [
          'On-Site programs are attended in person. Online programs are attended from home through live Google Meet classes.',
          'You can filter the list of programs by either type.',
        ],
      },
      {
        question: 'Can I enroll now and pay later?',
        answer: [
          'Yes. At checkout, tick the Pay later box and click Submit Enrollment Request.',
          'You can then send your payment after the admin approves your enrollment.',
        ],
      },
      {
        question: 'Why is my course not showing on my dashboard?',
        answer: [
          'It is most likely still waiting for admin approval. Look under Pending Enrollments on your dashboard.',
          'Once it is approved, the program moves into My Courses and you can start studying.',
        ],
      },
    ],
  },
  {
    id: 'payments',
    title: 'Payments',
    items: [
      {
        question: 'How can I pay?',
        answer: [
          'We accept bank transfer through BPI and payment through GCash.',
          'The account details are shown on screen at checkout and whenever you add a payment, so you always have the current ones in front of you.',
        ],
      },
      {
        question: 'How do I send my proof of payment?',
        answer: [
          'On your dashboard, find the course under Payment and click Add payment.',
          'Enter the amount you sent, choose the month if your course is billed monthly, upload a photo or screenshot of your receipt, and click Submit Payment.',
          'The receipt can be a JPG, PNG or WEBP image of up to 10MB.',
        ],
      },
      {
        question: 'I already paid. Why does it still say Partial?',
        answer: [
          'An admin has to check your proof of payment first. Until then it shows as Payment under review.',
          'Partial also appears when part of the course fee is still unpaid. It changes to Paid once the course is settled in full.',
        ],
      },
      {
        question: 'Why was my payment rejected?',
        answer: [
          'Something was wrong with the proof you sent, for example an unreadable receipt or an amount that does not match.',
          'The reason is written next to the rejected payment. Read it, then send the payment again with a corrected proof.',
        ],
      },
      {
        question: 'Can I pay for several months in advance?',
        answer: [
          'Yes. For courses billed monthly, you do not need to wait for one month to be approved before paying for the next.',
        ],
      },
    ],
  },
  {
    id: 'classes',
    title: 'Classes and lessons',
    items: [
      {
        question: 'How do I join my live class?',
        answer: [
          'Your class days and times are listed under Upcoming Schedule on your dashboard.',
          'If the class has a Google Meet, click its badge there, or click Join Google Meet on the course page.',
        ],
      },
      {
        question: 'I missed a class. Can I watch the recording?',
        answer: [
          'Yes. Open the subject and go to the Recordings tab, which holds the recordings of your past live classes.',
        ],
      },
      {
        question: 'Why does a lesson have a padlock?',
        answer: [
          'The lesson is not open yet. The reason is written under the lesson name, for example "Pass the Lesson 3 quiz to unlock."',
          'Finish the lesson it names and the next one opens.',
        ],
      },
      {
        question: 'How is a lesson marked as completed?',
        answer: [
          'A lesson that has a quiz is marked done automatically once you pass the quiz.',
          'A green check appears on the lesson and your progress bar moves up.',
        ],
      },
    ],
  },
  {
    id: 'assessments',
    title: 'Quizzes and exams',
    items: [
      {
        question: 'How many attempts do I get?',
        answer: [
          'Subject quizzes and exams allow one attempt only.',
          'Quizzes attached to a lesson can be retaken: if you do not reach the passing score, a Try again button appears.',
        ],
      },
      {
        question: 'What happens if my time runs out or I close the page?',
        answer: [
          'The timer cannot be paused. When it runs out, whatever you have answered is submitted automatically.',
          'If you closed the page by accident, open the assessment again. You can carry on if there is still time left.',
          'Make sure your internet connection is stable before you start a timed exam.',
        ],
      },
      {
        question: 'Why does my score say "Awaiting grading"?',
        answer: [
          'Your assessment has essay questions, which your teacher checks by hand.',
          'Multiple choice and true or false questions are scored right away, and your final score appears once the essays are graded.',
        ],
      },
      {
        question: 'Can I review my answers after submitting?',
        answer: [
          'Yes. Open the assessment again and click Review answers.',
        ],
      },
    ],
  },
  {
    id: 'certificates',
    title: 'Certificates',
    items: [
      {
        question: 'How do I get my certificate?',
        answer: [
          'You need three things: every subject in the course graded, an average that reaches the passing grade for the course, and the course fully paid.',
          'Once all three are met, the certificate unlocks on the course page.',
        ],
      },
      {
        question: 'Why is my certificate locked?',
        answer: [
          'The reason is shown under Certificate locked on the course page.',
          'It is usually a subject that has not been graded yet, an average below the passing grade, or an unpaid balance.',
        ],
      },
      {
        question: 'How do I download or print my certificate?',
        answer: [
          'Click Download Certificate on the course page, then use the print button to print it or save it as a PDF.',
        ],
      },
    ],
  },
]

/** schema.org FAQPage data, so search engines can show the answers directly. */
export function faqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_CATEGORIES.flatMap((category) =>
      category.items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer.join(' ') },
      })),
    ),
  }
}
