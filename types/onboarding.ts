export type CrashlyRole = 'stay' | 'host' | 'both';

export type OnboardingData = {
  role: CrashlyRole;
  firstName: string;
  lastName: string;
  university: string;
  city: string;
  cohabitPreference: 'same_gender' | 'no_preference' | 'open';
  paying?: 'yes_always' | 'depends' | 'prefer_free';
  charging?: 'yes' | 'free' | 'depends';
  availability?: Array<'weekdays' | 'weekends' | 'mornings' | 'evenings'>;
};
