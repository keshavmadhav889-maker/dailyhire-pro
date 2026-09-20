import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';
import {getStoredLanguage, storeLanguage} from '../utils/storage';
import {DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES} from '../constants/app';
import type {Language} from '../types';

export type TranslationKey =
  | 'appTagline'
  | 'continue'
  | 'back'
  | 'loading'
  | 'retry'
  | 'errorTitle'
  | 'errorBody'
  | 'emptyTitle'
  | 'emptyBody'
  | 'noResults'
  | 'selectRole'
  | 'roleTitle'
  | 'roleSubtitle'
  | 'employer'
  | 'worker'
  | 'employerDescription'
  | 'workerDescription'
  | 'email'
  | 'emailPlaceholder'
  | 'emailInvalid'
  | 'sendOtp'
  | 'otp'
  | 'otpPlaceholder'
  | 'verifyOtp'
  | 'resendOtp'
  | 'otpSent'
  | 'otpExpired'
  | 'otpAttempts'
  | 'logout'
  | 'dashboard'
  | 'jobs'
  | 'searchJobs'
  | 'searchPlaceholder'
  | 'filters'
  | 'category'
  | 'location'
  | 'salary'
  | 'minSalary'
  | 'maxSalary'
  | 'startDate'
  | 'applyNow'
  | 'applied'
  | 'cancelApplication'
  | 'jobDetails'
  | 'jobDescription'
  | 'workersNeeded'
  | 'workingHours'
  | 'contactNumber'
  | 'featuredJobs'
  | 'latestJobs'
  | 'allJobs'
  | 'postJob'
  | 'myJobs'
  | 'applicants'
  | 'editJob'
  | 'deleteJob'
  | 'closeJob'
  | 'jobTitle'
  | 'jobTitlePlaceholder'
  | 'description'
  | 'descriptionPlaceholder'
  | 'dailySalary'
  | 'salaryUnit'
  | 'workersNeededPlaceholder'
  | 'workingHoursPlaceholder'
  | 'startDatePlaceholder'
  | 'contactPlaceholder'
  | 'save'
  | 'cancel'
  | 'delete'
  | 'close'
  | 'accept'
  | 'reject'
  | 'status'
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'cancelled'
  | 'open'
  | 'closed'
  | 'filled'
  | 'profile'
  | 'editProfile'
  | 'fullName'
  | 'phone'
  | 'age'
  | 'gender'
  | 'address'
  | 'villageCity'
  | 'skills'
  | 'experience'
  | 'businessName'
  | 'preferredCategories'
  | 'profilePhoto'
  | 'uploadPhoto'
  | 'camera'
  | 'gallery'
  | 'notifications'
  | 'markAllRead'
  | 'noNotifications'
  | 'newJobPosted'
  | 'applicationReceived'
  | 'applicationAccepted'
  | 'applicationRejected'
  | 'jobClosed'
  | 'accountNotification'
  | 'admin'
  | 'adminDashboard'
  | 'users'
  | 'employers'
  | 'workers'
  | 'reports'
  | 'blockUser'
  | 'unblockUser'
  | 'removeJob'
  | 'reviewReports'
  | 'overview'
  | 'activeJobs'
  | 'totalApplications'
  | 'language'
  | 'english'
  | 'hindi'
  | 'offline'
  | 'networkError'
  | 'permissionDenied'
  | 'photoTooLarge'
  | 'jobCreated'
  | 'jobUpdated'
  | 'jobDeleted'
  | 'applicationSubmitted'
  | 'applicationCancelled'
  | 'profileSaved'
  | 'sessionExpired'
  | 'roleMismatch'
  | 'blockedAccount'
  | 'adminOnly'
  | 'notFound'
  | 'lastUpdated'
  | 'viewDetails'
  | 'perDay'
  | 'perHour'
  | 'fixed'
  | 'allCategories'
  | 'construction'
  | 'farming'
  | 'delivery'
  | 'helper'
  | 'electrician'
  | 'plumber'
  | 'driver'
  | 'loader'
  | 'agricultureLabour'
  | 'other'
  | 'female'
  | 'male'
  | 'otherGender'
  | 'preferNotToSay'
  | 'years'
  | 'daysAgo'
  | 'today'
  | 'clearFilters'
  | 'loadingMore'
  | 'pullRefresh'
  | 'noJobs'
  | 'noApplications'
  | 'noApplicants'
  | 'noUsers'
  | 'noReports'
  | 'jobOwnershipError'
  | 'duplicateApplication'
  | 'unauthorized'
  | 'unknownError'
  | 'confirmDelete'
  | 'confirmClose'
  | 'yes'
  | 'no'
  | 'appName';

export interface TranslationValues {
  [key: string]: string | number;
}

export interface LocalizationContextValue {
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
  t: (key: TranslationKey, values?: TranslationValues) => string;
  isRTL: boolean;
}

const en: Record<TranslationKey, string> = {
  appName: 'DailyHire',
  appTagline: 'Gaav ka Apna Rozgar App',
  continue: 'Continue',
  back: 'Back',
  loading: 'Loading...',
  retry: 'Retry',
  errorTitle: 'Something went wrong',
  errorBody: 'Please try again in a moment.',
  emptyTitle: 'Nothing here yet',
  emptyBody: 'New items will appear here.',
  noResults: 'No results found',
  selectRole: 'Who are you?',
  roleTitle: 'Find work or hire local help',
  roleSubtitle: 'Choose your role to continue',
  employer: 'Employer',
  worker: 'Worker',
  employerDescription: 'Post jobs and connect with reliable local workers',
  workerDescription: 'Find daily work near you and apply in one tap',
  email: 'Email',
  emailPlaceholder: 'you@example.com',
  emailInvalid: 'Enter a valid email address',
  sendOtp: 'Send secure OTP',
  otp: 'One-time password',
  otpPlaceholder: '6-digit code',
  verifyOtp: 'Verify and continue',
  resendOtp: 'Resend code',
  otpSent: 'A secure code was sent to your email',
  otpExpired: 'The code expired. Request a new one.',
  otpAttempts: 'Verification attempts remaining',
  logout: 'Log out',
  dashboard: 'Dashboard',
  jobs: 'Jobs',
  searchJobs: 'Search jobs',
  searchPlaceholder: 'Title, skill, or village',
  filters: 'Filters',
  category: 'Category',
  location: 'Location',
  salary: 'Salary',
  minSalary: 'Minimum salary',
  maxSalary: 'Maximum salary',
  startDate: 'Start date',
  applyNow: 'Apply now',
  applied: 'Applied',
  cancelApplication: 'Cancel application',
  jobDetails: 'Job details',
  jobDescription: 'Description',
  workersNeeded: 'Workers needed',
  workingHours: 'Working hours',
  contactNumber: 'Contact number',
  featuredJobs: 'Featured jobs',
  latestJobs: 'Latest jobs',
  allJobs: 'All jobs',
  postJob: 'Post a job',
  myJobs: 'My jobs',
  applicants: 'Applicants',
  editJob: 'Edit job',
  deleteJob: 'Delete job',
  closeJob: 'Close job',
  jobTitle: 'Job title',
  jobTitlePlaceholder: 'e.g. Farm helper needed',
  description: 'Description',
  descriptionPlaceholder: 'Describe the work, timing, and requirements',
  dailySalary: 'Daily salary',
  salaryUnit: 'Pay unit',
  workersNeededPlaceholder: 'Number of workers',
  workingHoursPlaceholder: 'e.g. 8:00 AM to 5:00 PM',
  startDatePlaceholder: 'Start date',
  contactPlaceholder: 'Contact number',
  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
  close: 'Close',
  accept: 'Accept',
  reject: 'Reject',
  status: 'Status',
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  open: 'Open',
  closed: 'Closed',
  filled: 'Filled',
  profile: 'Profile',
  editProfile: 'Edit profile',
  fullName: 'Full name',
  phone: 'Phone',
  age: 'Age',
  gender: 'Gender',
  address: 'Address',
  villageCity: 'Village / city',
  skills: 'Skills',
  experience: 'Experience',
  businessName: 'Business name',
  preferredCategories: 'Preferred categories',
  profilePhoto: 'Profile photo',
  uploadPhoto: 'Upload photo',
  camera: 'Camera',
  gallery: 'Gallery',
  notifications: 'Notifications',
  markAllRead: 'Mark all as read',
  noNotifications: 'No notifications yet',
  newJobPosted: 'New job posted',
  applicationReceived: 'Application received',
  applicationAccepted: 'Application accepted',
  applicationRejected: 'Application rejected',
  jobClosed: 'Job closed',
  accountNotification: 'Account notification',
  admin: 'Admin',
  adminDashboard: 'Admin dashboard',
  users: 'Users',
  employers: 'Employers',
  workers: 'Workers',
  reports: 'Reports',
  blockUser: 'Block user',
  unblockUser: 'Unblock user',
  removeJob: 'Remove job',
  reviewReports: 'Review reports',
  overview: 'Overview',
  activeJobs: 'Active jobs',
  totalApplications: 'Total applications',
  language: 'Language',
  english: 'English',
  hindi: 'Hindi',
  offline: 'You are offline. Changes will sync when connected.',
  networkError: 'Network error. Check your connection and try again.',
  permissionDenied: 'Permission was not granted',
  photoTooLarge: 'Choose an image smaller than 5 MB',
  jobCreated: 'Job posted successfully',
  jobUpdated: 'Job updated successfully',
  jobDeleted: 'Job removed successfully',
  applicationSubmitted: 'Application submitted',
  applicationCancelled: 'Application cancelled',
  profileSaved: 'Profile saved successfully',
  sessionExpired: 'Your session expired. Please sign in again.',
  roleMismatch: 'This account does not have the selected role',
  blockedAccount: 'This account is unavailable. Contact support.',
  adminOnly: 'Admin access is required',
  notFound: 'Item not found',
  lastUpdated: 'Updated',
  viewDetails: 'View details',
  perDay: '/ day',
  perHour: '/ hour',
  fixed: 'Fixed',
  allCategories: 'All categories',
  construction: 'Construction',
  farming: 'Farming',
  delivery: 'Delivery',
  helper: 'Helper',
  electrician: 'Electrician',
  plumber: 'Plumber',
  driver: 'Driver',
  loader: 'Loader',
  agricultureLabour: 'Agriculture Labour',
  other: 'Other',
  female: 'Female',
  male: 'Male',
  otherGender: 'Other',
  preferNotToSay: 'Prefer not to say',
  years: 'years',
  daysAgo: 'days ago',
  today: 'Today',
  clearFilters: 'Clear filters',
  loadingMore: 'Loading more...',
  pullRefresh: 'Pull to refresh',
  noJobs: 'No jobs available',
  noApplications: 'No applications yet',
  noApplicants: 'No applicants yet',
  noUsers: 'No users found',
  noReports: 'No reports to review',
  jobOwnershipError: 'You can only manage your own jobs',
  duplicateApplication: 'You have already applied to this job',
  unauthorized: 'You are not authorized to do this',
  unknownError: 'An unexpected error occurred',
  confirmDelete: 'Delete this item?',
  confirmClose: 'Close this job?',
  yes: 'Yes',
  no: 'No',
};

const hi: Record<TranslationKey, string> = {
  appName: 'DailyHire',
  appTagline: 'Gaav ka Apna Rozgar App',
  continue: 'जारी रखें',
  back: 'पीछे',
  loading: 'लोड हो रहा है...',
  retry: 'फिर से कोशिश करें',
  errorTitle: 'कुछ गलत हो गया',
  errorBody: 'कृपया थोड़ी देर बाद फिर से प्रयास करें।',
  emptyTitle: 'अभी कुछ नहीं है',
  emptyBody: 'नई जानकारी यहां दिखाई देगी।',
  noResults: 'कोई परिणाम नहीं मिला',
  selectRole: 'आप कौन हैं?',
  roleTitle: 'काम खोजें या स्थानीय मदद लें',
  roleSubtitle: 'जारी रखने के लिए अपनी भूमिका चुनें',
  employer: 'मालिक',
  worker: 'मजदूर',
  employerDescription: 'नौकरियां डालें और भरोसेमंद स्थानीय मजदूरों से जुड़ें',
  workerDescription: 'आसपास के रोजगार खोजें और एक क्लिक में आवेदन करें',
  email: 'ईमेल',
  emailPlaceholder: 'you@example.com',
  emailInvalid: 'सही ईमेल दर्ज करें',
  sendOtp: 'सुरक्षित OTP भेजें',
  otp: 'एक बार का कोड',
  otpPlaceholder: '6 अंकों का कोड',
  verifyOtp: 'सत्यापित करें और जारी रखें',
  resendOtp: 'कोड फिर भेजें',
  otpSent: 'आपके ईमेल पर सुरक्षित कोड भेजा गया',
  otpExpired: 'कोड की समय-सीमा समाप्त हो गई। नया कोड मंगाएं।',
  otpAttempts: 'शेष सत्यापन प्रयास',
  logout: 'लॉग आउट',
  dashboard: 'डैशबोर्ड',
  jobs: 'काम',
  searchJobs: 'काम खोजें',
  searchPlaceholder: 'काम, कौशल या गांव लिखें',
  filters: 'फ़िल्टर',
  category: 'श्रेणी',
  location: 'स्थान',
  salary: 'वेतन',
  minSalary: 'न्यूनतम वेतन',
  maxSalary: 'अधिकतम वेतन',
  startDate: 'आरंभ तिथि',
  applyNow: 'अभी आवेदन करें',
  applied: 'आवेदन किया',
  cancelApplication: 'आवेदन रद्द करें',
  jobDetails: 'काम का विवरण',
  jobDescription: 'विवरण',
  workersNeeded: 'आवश्यक मजदूर',
  workingHours: 'काम का समय',
  contactNumber: 'संपर्क नंबर',
  featuredJobs: 'विशेष काम',
  latestJobs: 'नए काम',
  allJobs: 'सभी काम',
  postJob: 'काम पोस्ट करें',
  myJobs: 'मेरे काम',
  applicants: 'आवेदक',
  editJob: 'काम संपादित करें',
  deleteJob: 'काम हटाएं',
  closeJob: 'काम बंद करें',
  jobTitle: 'काम का शीर्षक',
  jobTitlePlaceholder: 'जैसे खेत में मदद चाहिए',
  description: 'विवरण',
  descriptionPlaceholder: 'काम, समय और आवश्यकताएं लिखें',
  dailySalary: 'दैनिक वेतन',
  salaryUnit: 'भुगतान का प्रकार',
  workersNeededPlaceholder: 'मजदूरों की संख्या',
  workingHoursPlaceholder: 'जैसे सुबह 8 से शाम 5 बजे तक',
  startDatePlaceholder: 'आरंभ तिथि',
  contactPlaceholder: 'संपर्क नंबर',
  save: 'सहेजें',
  cancel: 'रद्द करें',
  delete: 'हटाएं',
  close: 'बंद करें',
  accept: 'स्वीकार करें',
  reject: 'अस्वीकार करें',
  status: 'स्थिति',
  pending: 'प्रतीक्षा में',
  accepted: 'स्वीकार किया',
  rejected: 'अस्वीकार किया',
  cancelled: 'रद्द',
  open: 'खुला',
  closed: 'बंद',
  filled: 'पूरा',
  profile: 'प्रोफ़ाइल',
  editProfile: 'प्रोफ़ाइल संपादित करें',
  fullName: 'पूरा नाम',
  phone: 'फोन',
  age: 'आयु',
  gender: 'लिंग',
  address: 'पता',
  villageCity: 'गांव / शहर',
  skills: 'कौशल',
  experience: 'अनुभव',
  businessName: 'व्यवसाय का नाम',
  preferredCategories: 'पसंदीदा श्रेणियां',
  profilePhoto: 'प्रोफ़ाइल फोटो',
  uploadPhoto: 'फोटो लगाएं',
  camera: 'कैमरा',
  gallery: 'गैलरी',
  notifications: 'सूचनाएं',
  markAllRead: 'सभी पढ़े हुए करें',
  noNotifications: 'अभी कोई सूचना नहीं',
  newJobPosted: 'नया काम पोस्ट किया गया',
  applicationReceived: 'आवेदन मिला',
  applicationAccepted: 'आवेदन स्वीकार किया',
  applicationRejected: 'आवेदन अस्वीकार किया',
  jobClosed: 'काम बंद किया गया',
  accountNotification: 'खाते की सूचना',
  admin: 'व्यवस्थापक',
  adminDashboard: 'व्यवस्थापक डैशबोर्ड',
  users: 'सदस्य',
  employers: 'मालिक',
  workers: 'मजदूर',
  reports: 'रिपोर्ट',
  blockUser: 'सदस्य को अवरुद्ध करें',
  unblockUser: 'सदस्य को खोलें',
  removeJob: 'काम हटाएं',
  reviewReports: 'रिपोर्ट जांचें',
  overview: 'सारांश',
  activeJobs: 'सक्रिय काम',
  totalApplications: 'कुल आवेदन',
  language: 'भाषा',
  english: 'अंग्रेजी',
  hindi: 'हिंदी',
  offline: 'आप ऑफ़लाइन हैं। जुड़ने पर बदलाव सहक्रियेट होंगे।',
  networkError: 'नेटवर्क त्रुटि। कनेक्शन जांचकर फिर कोशिश करें।',
  permissionDenied: 'अनुमति नहीं दी गई',
  photoTooLarge: '5 MB से छोटी तस्वीर चुनें',
  jobCreated: 'काम सफलतापूर्वक पोस्ट किया गया',
  jobUpdated: 'काम सफलतापूर्वक बदला गया',
  jobDeleted: 'काम हटा दिया गया',
  applicationSubmitted: 'आवेदन भेज दिया गया',
  applicationCancelled: 'आवेदन रद्द कर दिया गया',
  profileSaved: 'प्रोफ़ाइल सहेजा गया',
  sessionExpired: 'आपका सत्र समाप्त हो गया। फिर से लॉगिन करें।',
  roleMismatch: 'इस खाते में चुनी गई भूमिका नहीं है',
  blockedAccount: 'यह खाता उपलब्ध नहीं है। सहायता से संपर्क करें।',
  adminOnly: 'व्यवस्थापक पहुंच आवश्यक है',
  notFound: 'वस्तु नहीं मिली',
  lastUpdated: 'अंतिम अपडेट',
  viewDetails: 'विवरण देखें',
  perDay: '/ दिन',
  perHour: '/ घंटा',
  fixed: 'निश्चित',
  allCategories: 'सभी श्रेणियां',
  construction: 'निर्माण',
  farming: 'खेती',
  delivery: 'डिलीवरी',
  helper: 'मदद',
  electrician: 'इलेक्ट्रीशियन',
  plumber: 'प्लंबर',
  driver: 'ड्राइवर',
  loader: 'लोडर',
  agricultureLabour: 'कृषि मजदूर',
  other: 'अन्य',
  female: 'महिला',
  male: 'पुरुष',
  otherGender: 'अन्य',
  preferNotToSay: 'नहीं बताना चाहुंगा/चाहूंगी',
  years: 'वर्ष',
  daysAgo: 'दिन पहले',
  today: 'आज',
  clearFilters: 'फ़िल्टर साफ करें',
  loadingMore: 'और लोड हो रहा है...',
  pullRefresh: 'ताज़ा करने के लिए खींचें',
  noJobs: 'कोई काम उपलब्ध नहीं',
  noApplications: 'अभी कोई आवेदन नहीं',
  noApplicants: 'अभी कोई आवेदक नहीं',
  noUsers: 'कोई सदस्य नहीं मिले',
  noReports: 'जांच के लिए कोई रिपोर्ट नहीं',
  jobOwnershipError: 'आप केवल अपने काम संबंधित कार्रवाई कर सकते हैं',
  duplicateApplication: 'आप इस काम के लिए पहले ही आवेदन कर चुके हैं',
  unauthorized: 'आपको यह कार्रवाई करने की अनुमति नहीं है',
  unknownError: 'एक अप्रत्याशित त्रुटि हुई',
  confirmDelete: 'इसे हटाना है?',
  confirmClose: 'इस काम को बंद करना है?',
  yes: 'हां',
  no: 'नहीं',
};

export const translations = {en, hi} as const;

const LocalizationContext = createContext<LocalizationContextValue | undefined>(undefined);

export function LocalizationProvider({children}: {children: React.ReactNode}) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [ready, setReady] = useState(false);

  React.useEffect(() => {
    let mounted = true;
    getStoredLanguage()
      .then((stored) => {
        if (mounted && SUPPORTED_LANGUAGES.includes(stored)) {
          setLanguageState(stored);
        }
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = useCallback(async (next: Language) => {
    await storeLanguage(next);
    setLanguageState(next);
  }, []);

  const value = useMemo<LocalizationContextValue>(
    () => ({
      language,
      setLanguage,
      isRTL: language === 'hi',
      t: (key, values) => {
        let result = (translations as Record<Language, Record<TranslationKey, string>>)[language][key] ?? translations.en[key] ?? key;
        if (values) {
          Object.entries(values).forEach(([name, value]) => {
            result = result.replace(`{${name}}`, String(value));
          });
        }
        return result;
      },
    }),
    [language, setLanguage],
  );

  if (!ready) return null;
  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useLocalization(): LocalizationContextValue {
  const context = useContext(LocalizationContext);
  if (!context) throw new Error('useLocalization must be used within LocalizationProvider');
  return context;
}

export function useTranslation() {
  const {t, language, setLanguage, isRTL} = useLocalization();
  return {t, language, setLanguage, isRTL};
}
