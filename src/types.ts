export interface ParsedResume {
  id: string;
  fileName: string;
  uploadDate: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  errorMsg?: string;
  data?: ResumeData;
  fileLink?: string; // URL to view the file
}

export interface ResumeData {
  name: string;
  gender: string;
  dob: string;
  mobile: string;
  workExperienceYears: string;
  specialIdentity: string;
  lastCompanyName: string;
  lastJobTitle: string;
  householdCity: string;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
}