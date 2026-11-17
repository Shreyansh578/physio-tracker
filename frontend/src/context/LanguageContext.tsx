import React, { createContext, useContext, useState } from 'react';

export type Language = 'en' | 'hi' | 'es' | 'fr' | 'de';

export interface LanguageOption {
  code: Language;
  label: string;
  nativeLabel: string;
  flag: string;
  speechLocale: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧', speechLocale: 'en-US' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', flag: '🇮🇳', speechLocale: 'hi-IN' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', flag: '🇪🇸', speechLocale: 'es-ES' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', flag: '🇫🇷', speechLocale: 'fr-FR' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', flag: '🇩🇪', speechLocale: 'de-DE' },
];

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    // Nav
    nav_dashboard: 'Dashboard',
    nav_live_workout: 'Live Workout',
    nav_ai_coach: 'AI Physio Coach',
    nav_analytics: 'Analytics & ROM',
    nav_library: 'Exercise Library',
    nav_settings: 'Settings & Buzzer',
    nav_sign_out: 'Sign Out',
    nav_sign_in: 'Sign In',
    nav_patient: 'Patient',

    // Titles
    title_dashboard: 'Patient Recovery Dashboard',
    title_live_workout: 'Live Vision Workout Session',
    title_summary: 'Session Biomechanical Summary',
    title_ai_coach: 'Dr. Alex - AI Physical Therapy Consultation',
    title_analytics: 'Kinematic Recovery & Trend Analytics',
    title_library: 'Rehabilitation Exercise Encyclopedia',
    title_settings: 'System Settings & Buzzer Calibration',

    // Live Workout & HUD
    hud_completed_reps: 'Completed Reps',
    hud_accuracy: 'Accuracy',
    hud_rom: 'Range of Motion',
    hud_good_posture: 'Good Posture',
    hud_form_caution: 'Form Caution',
    hud_form_defect: 'Form Defect',
    hud_buzzer_on: '🔊 Buzzer ON',
    hud_buzzer_muted: '🔇 Muted',
    hud_end_workout: 'End Workout & View Analysis',
    hud_ready_to_curl: '⬇️ READY TO CURL',
    hud_curling_up: '⚡ CURLING UP',
    hud_peak_contraction: '🔥 PEAK CONTRACTION',
    hud_lowering_down: '⬇️ LOWERING DOWN',
    hud_extend_arm: '⏳ EXTEND ARM DOWN',

    // Fault Callouts & Speech
    fault_alert_title: 'STOP! THIS IS YOUR FAULT',
    fault_area_label: 'Fault Area',
    fault_area_elbow: 'Elbow Joint Alignment',
    fault_area_spine: 'Lumbar Spine / Lower Back',
    fault_area_knee: 'Knees & Patella (Valgus)',
    fault_area_rom: 'Range of Motion / Extension',

    fault_msg_elbow_drift: 'Your elbow is drifting forward. Keep it pinned to your ribs.',
    fault_msg_torso_swing: 'You are swinging your lower back. Lock your core and stand tall.',
    fault_msg_incomplete_ext: 'Lower down fully to 160° before beginning your next repetition.',
    fault_msg_knee_valgus: 'Knees caving inward. Drive your knees outward over your toes.',

    speech_fault_prefix: 'Stop! This is your fault:',
    speech_fault_elbow: 'Stop! This is your fault: your elbow is drifting forward away from your body. Fault area: Elbow Joint. Watch the technique video.',
    speech_fault_swing: 'Stop! This is your fault: you are swinging your lower back to lift weight. Fault area: Lumbar Spine. Watch the technique video.',
    speech_fault_incomplete: 'Stop! This is your fault: you are not fully extending your arm down. Fault area: Elbow Extension. Watch the technique video.',
    speech_rep_completed: 'Clean repetition completed. Keep it steady.',

    // Video Correction Modal
    video_modal_title: 'Interactive Biomechanical Correction Guide',
    video_modal_subtitle: 'The AI halted your workout due to repeated defective repetitions. Review proper joint mechanics below before continuing.',
    video_correct_posture: '✅ Correct Clinical Posture',
    video_incorrect_posture: '❌ Your Defective Posture',
    video_key_takeaways: 'Key Biomechanical Principles:',
    video_resume_btn: 'I Understand — Resume Workout',
    video_demonstration: 'Visual Motion Kinematics Guide',
  },

  hi: {
    // Nav
    nav_dashboard: 'डैशबोर्ड',
    nav_live_workout: 'लाइव वर्कआउट',
    nav_ai_coach: 'एआई फिजियो कोच',
    nav_analytics: 'एनालिटिक्स और गति सीमा',
    nav_library: 'व्यायाम लाइब्रेरी',
    nav_settings: 'सेटिंग्स और बज़र',
    nav_sign_out: 'साइन आउट',
    nav_sign_in: 'साइन इन',
    nav_patient: 'मरीज़',

    // Titles
    title_dashboard: 'मरीज़ रिकवरी डैशबोर्ड',
    title_live_workout: 'लाइव विज़न वर्कआउट सत्र',
    title_summary: 'सत्र बायोमैकेनिकल सारांश',
    title_ai_coach: 'डॉ. एलेक्स - एआई फिजियोथेरेपी परामर्श',
    title_analytics: 'काइनेमेटिक रिकवरी और ट्रेंड एनालिटिक्स',
    title_library: 'पुनर्वास व्यायाम विश्वकोश',
    title_settings: 'सिस्टम सेटिंग्स और बज़र अंशांकन',

    // Live Workout & HUD
    hud_completed_reps: 'पूर्ण किए गए रेप्स',
    hud_accuracy: 'सटीकता',
    hud_rom: 'गति की सीमा (ROM)',
    hud_good_posture: 'सही मुद्रा',
    hud_form_caution: 'मुद्रा सावधानी',
    hud_form_defect: 'मुद्रा में दोष',
    hud_buzzer_on: '🔊 बज़र चालू',
    hud_buzzer_muted: '🔇 म्यूट',
    hud_end_workout: 'वर्कआउट समाप्त करें और विश्लेषण देखें',
    hud_ready_to_curl: '⬇️ कर्ल के लिए तैयार',
    hud_curling_up: '⚡ ऊपर कर्ल कर रहे हैं',
    hud_peak_contraction: '🔥 शीर्ष संकुचन',
    hud_lowering_down: '⬇️ धीरे-धीरे नीचे लाएं',
    hud_extend_arm: '⏳ हाथ को सीधा नीचे लाएं',

    // Fault Callouts & Speech
    fault_alert_title: 'रुकिए! यह आपकी गलती है',
    fault_area_label: 'दोष क्षेत्र',
    fault_area_elbow: 'कोहनी का जोड़',
    fault_area_spine: 'कमर का निचला हिस्सा / रीढ़',
    fault_area_knee: 'घुटने की स्थिति (वालगस)',
    fault_area_rom: 'गति की सीमा / विस्तार',

    fault_msg_elbow_drift: 'आपकी कोहनी आगे बढ़ रही है। इसे अपनी पसलियों के पास स्थिर रखें।',
    fault_msg_torso_swing: 'आप वजन उठाने के लिए कमर को पीछे झुका रहे हैं। पेट को टाइट रखें और सीधे खड़े हों।',
    fault_msg_incomplete_ext: 'अगला रेप्स शुरू करने से पहले हाथ को पूरी तरह नीचे 160° तक सीधा करें।',
    fault_msg_knee_valgus: 'घुटने अंदर की ओर दब रहे हैं। घुटनों को पंजों की सीध में बाहर रखें।',

    speech_fault_prefix: 'रुकिए! यह आपकी गलती है:',
    speech_fault_elbow: 'रुकिए! यह आपकी गलती है: आपकी कोहनी शरीर से आगे खिसक रही है। दोष क्षेत्र: कोहनी का जोड़। सुधार वीडियो देखें।',
    speech_fault_swing: 'रुकिए! यह आपकी गलती है: आप वजन उठाने के लिए कमर हिला रहे हैं। दोष क्षेत्र: रीढ़ की हड्डी। सुधार वीडियो देखें।',
    speech_fault_incomplete: 'रुकिए! यह आपकी गलती है: आप हाथ को पूरा सीधा नहीं कर रहे हैं। सुधार वीडियो देखें।',
    speech_rep_completed: 'शानदार रेप्स पूरा हुआ। गति बनाए रखें।',

    // Video Correction Modal
    video_modal_title: 'इंटरएक्टिव बायोमैकेनिकल सुधार गाइड',
    video_modal_subtitle: 'लगातार गलत मुद्रा के कारण एआई ने व्यायाम रोक दिया है। जारी रखने से पहले नीचे सही तकनीक देखें।',
    video_correct_posture: '✅ सही चिकित्सीय मुद्रा',
    video_incorrect_posture: '❌ आपकी गलत मुद्रा',
    video_key_takeaways: 'मुख्य बायोमैकेनिकल नियम:',
    video_resume_btn: 'मैं समझ गया — वर्कआउट फिर शुरू करें',
    video_demonstration: 'विज़ुअल मोशन काइनेमेटिक्स गाइड',
  },

  es: {
    // Nav
    nav_dashboard: 'Panel de Control',
    nav_live_workout: 'Entrenamiento en Vivo',
    nav_ai_coach: 'Entrenador IA',
    nav_analytics: 'Analítica y ROM',
    nav_library: 'Biblioteca de Ejercicios',
    nav_settings: 'Ajustes y Alarma',
    nav_sign_out: 'Cerrar Sesión',
    nav_sign_in: 'Iniciar Sesión',
    nav_patient: 'Paciente',

    // Titles
    title_dashboard: 'Panel de Recuperación del Paciente',
    title_live_workout: 'Sesión de Entrenamiento con Visión IA',
    title_summary: 'Resumen Biomecánico de la Sesión',
    title_ai_coach: 'Dr. Alex - Consulta de Fisioterapia IA',
    title_analytics: 'Cinemática de Recuperación y Tendencias',
    title_library: 'Enciclopedia de Rehabilitación',
    title_settings: 'Ajustes del Sistema y Calibración',

    // Live Workout & HUD
    hud_completed_reps: 'Repeticiones Logradas',
    hud_accuracy: 'Precisión',
    hud_rom: 'Rango de Movimiento',
    hud_good_posture: 'Buena Postura',
    hud_form_caution: 'Precaución de Forma',
    hud_form_defect: 'Falla Postural',
    hud_buzzer_on: '🔊 Zumbador ACTIVO',
    hud_buzzer_muted: '🔇 Silenciado',
    hud_end_workout: 'Finalizar y Ver Análisis',
    hud_ready_to_curl: '⬇️ LISTO PARA FLEXIÓN',
    hud_curling_up: '⚡ SUBIENDO',
    hud_peak_contraction: '🔥 CONTRACCIÓN MÁXIMA',
    hud_lowering_down: '⬇️ BAJANDO DESPACIO',
    hud_extend_arm: '⏳ EXTIENDE EL BRAZO',

    // Fault Callouts & Speech
    fault_alert_title: '¡ALTO! ESTA ES TU FALLA',
    fault_area_label: 'Área de Falla',
    fault_area_elbow: 'Alineación del Codo',
    fault_area_spine: 'Columna Lumbar / Espalda',
    fault_area_knee: 'Rodillas y Rótula',
    fault_area_rom: 'Rango de Movimiento',

    fault_msg_elbow_drift: 'Tu codo se desplaza hacia adelante. Mantenlo pegado a tus costillas.',
    fault_msg_torso_swing: 'Te balanceas hacia atrás para levantar el peso. Activa tu abdomen y quédate erguido.',
    fault_msg_incomplete_ext: 'Baja el brazo completamente hasta 160° antes de la siguiente repetición.',
    fault_msg_knee_valgus: 'Tus rodillas se colapsan hacia adentro. Empújalas hacia afuera.',

    speech_fault_prefix: '¡Alto! Esta es tu falla:',
    speech_fault_elbow: '¡Alto! Esta es tu falla: tu codo se separa hacia adelante. Área: Codo. Mira el video de técnica.',
    speech_fault_swing: '¡Alto! Esta es tu falla: estás balanceando tu espalda lumbar. Área: Columna. Mira el video.',
    speech_fault_incomplete: '¡Alto! Esta es tu falla: no estás extendiendo el brazo completamente.',
    speech_rep_completed: 'Repetición limpia completada. Mantén el ritmo.',

    // Video Correction Modal
    video_modal_title: 'Guía Interactiva de Corrección Biomecánica',
    video_modal_subtitle: 'La IA pausó tu ejercicio debido a fallas repetidas. Revisa la técnica correcta antes de continuar.',
    video_correct_posture: '✅ Postura Clínica Correcta',
    video_incorrect_posture: '❌ Tu Postura Incorrecta',
    video_key_takeaways: 'Principios Biomecánicos Clave:',
    video_resume_btn: 'Entendido — Reanudar Entrenamiento',
    video_demonstration: 'Guía Visual Cinemática',
  },

  fr: {
    // Nav
    nav_dashboard: 'Tableau de bord',
    nav_live_workout: 'Entraînement en direct',
    nav_ai_coach: 'Coach Physio IA',
    nav_analytics: 'Analyses & ROM',
    nav_library: 'Bibliothèque d’exercices',
    nav_settings: 'Paramètres & Alarme',
    nav_sign_out: 'Déconnexion',
    nav_sign_in: 'Connexion',
    nav_patient: 'Patient',

    // Titles
    title_dashboard: 'Tableau de Récupération du Patient',
    title_live_workout: 'Séance d’Entraînement par Vision IA',
    title_summary: 'Résumé Biomécanique de la Séance',
    title_ai_coach: 'Dr. Alex - Consultation Kinésithérapie IA',
    title_analytics: 'Analyses Cinématiques de Récupération',
    title_library: 'Encyclopédie des Exercices de Rééducation',
    title_settings: 'Configuration du Système & Avertisseur',

    // Live Workout & HUD
    hud_completed_reps: 'Répétitions Réussies',
    hud_accuracy: 'Précision',
    hud_rom: 'Amplitude Articulaire',
    hud_good_posture: 'Bonne Posture',
    hud_form_caution: 'Attention à la Forme',
    hud_form_defect: 'Défaut Postural',
    hud_buzzer_on: '🔊 Alarme ACTIVE',
    hud_buzzer_muted: '🔇 Muet',
    hud_end_workout: 'Terminer et Voir l’Analyse',
    hud_ready_to_curl: '⬇️ PRÊT',
    hud_curling_up: '⚡ EN MONTÉE',
    hud_peak_contraction: '🔥 CONTRACTION MAX',
    hud_lowering_down: '⬇️ DESCENTE CONTRÔLÉE',
    hud_extend_arm: '⏳ TENDRE LE BRAS',

    // Fault Callouts & Speech
    fault_alert_title: 'STOP ! VOICI VOTRE ERREUR',
    fault_area_label: 'Zone Défectueuse',
    fault_area_elbow: 'Alignement du Coude',
    fault_area_spine: 'Colonne Lombaire / Dos',
    fault_area_knee: 'Genoux (Valgus)',
    fault_area_rom: 'Amplitude Articulaire',

    fault_msg_elbow_drift: 'Votre coude avance trop. Gardez-le collé contre vos côtes.',
    fault_msg_torso_swing: 'Vous balancez le dos pour soulever le poids. Gainez le tronc et restez droit.',
    fault_msg_incomplete_ext: 'Tendez complètement le bras à 160° avant la prochaine répétition.',
    fault_msg_knee_valgus: 'Les genoux rentrent vers l’intérieur. Écartez-les dans l’axe des pieds.',

    speech_fault_prefix: 'Stop ! Voici votre erreur :',
    speech_fault_elbow: 'Stop ! Voici votre erreur : votre coude avance trop vers l’avant. Zone : Coude. Regardez la vidéo.',
    speech_fault_swing: 'Stop ! Voici votre erreur : vous compensez avec le bas du dos. Zone : Colonne lombaire.',
    speech_fault_incomplete: 'Stop ! Vous ne tendez pas complètement le bras. Regardez la vidéo corrective.',
    speech_rep_completed: 'Répétition propre validée. Continuez ainsi.',

    // Video Correction Modal
    video_modal_title: 'Guide Interactif de Correction Biomécanique',
    video_modal_subtitle: 'L’IA a mis en pause l’exercice suite à des erreurs répétées. Vérifiez la technique correcte ci-dessous.',
    video_correct_posture: '✅ Posture Clinique Correcte',
    video_incorrect_posture: '❌ Votre Posture Incorrecte',
    video_key_takeaways: 'Principes Biomécaniques Essentiels :',
    video_resume_btn: 'J’ai Compris — Reprendre l’Exercice',
    video_demonstration: 'Démonstration Cinématique du Mouvement',
  },

  de: {
    // Nav
    nav_dashboard: 'Dashboard',
    nav_live_workout: 'Live-Training',
    nav_ai_coach: 'KI-Physio-Coach',
    nav_analytics: 'Analytik & ROM',
    nav_library: 'Übungsbibliothek',
    nav_settings: 'Einstellungen & Buzzer',
    nav_sign_out: 'Abmelden',
    nav_sign_in: 'Anmelden',
    nav_patient: 'Patient',

    // Titles
    title_dashboard: 'Patienten-Rehabilitations-Dashboard',
    title_live_workout: 'Live KI-Bewegungsanalyse-Training',
    title_summary: 'Biomechanische Trainingszusammenfassung',
    title_ai_coach: 'Dr. Alex - KI-Physiotherapie-Beratung',
    title_analytics: 'Kinematische Genesungs- und Trendanalysen',
    title_library: 'Rehabilitations-Übungslexikon',
    title_settings: 'Systemeinstellungen & Buzzer-Kalibrierung',

    // Live Workout & HUD
    hud_completed_reps: 'Wiederholungen',
    hud_accuracy: 'Genauigkeit',
    hud_rom: 'Bewegungsradius (ROM)',
    hud_good_posture: 'Gute Haltung',
    hud_form_caution: 'Haltungswarnung',
    hud_form_defect: 'Haltungsfehler',
    hud_buzzer_on: '🔊 Buzzer AKTIV',
    hud_buzzer_muted: '🔇 Stumm',
    hud_end_workout: 'Beenden & Analyse ansehen',
    hud_ready_to_curl: '⬇️ BEREIT ZUM CURL',
    hud_curling_up: '⚡ CURLEN',
    hud_peak_contraction: '🔥 MAXIMALE KONTRAKTION',
    hud_lowering_down: '⬇️ KONTROLLIERT ABSENKEN',
    hud_extend_arm: '⏳ ARM STRECKEN',

    // Fault Callouts & Speech
    fault_alert_title: 'STOPP! DAS IST IHR FEHLER',
    fault_area_label: 'Fehlerbereich',
    fault_area_elbow: 'Ellbogengelenk-Ausrichtung',
    fault_area_spine: 'Lendenwirbelsäule / Rücken',
    fault_area_knee: 'Knieausrichtung (Valgus)',
    fault_area_rom: 'Bewegungsausmaß / Streckung',

    fault_msg_elbow_drift: 'Ihr Ellbogen wandert nach vorne. Halten Sie ihn fest an den Rippen.',
    fault_msg_torso_swing: 'Sie schwingen den Rücken nach hinten. Rumpf anspannen und aufrecht stehen.',
    fault_msg_incomplete_ext: 'Arm vor der nächsten Wiederholung vollständig auf 160° absenken.',
    fault_msg_knee_valgus: 'Knie knicken nach innen. Drücken Sie die Knie nach außen.',

    speech_fault_prefix: 'Stopp! Das ist Ihr Fehler:',
    speech_fault_elbow: 'Stopp! Ihr Ellbogen wandert nach vorne ab. Bereich: Ellbogen. Korrekturvideo ansehen.',
    speech_fault_swing: 'Stopp! Sie schwingen aus dem unteren Rücken. Bereich: Lendenwirbelsäule.',
    speech_fault_incomplete: 'Stopp! Der Arm wird nicht vollständig gestreckt. Video beachten.',
    speech_rep_completed: 'Saubere Wiederholung gezählt. Weiter so.',

    // Video Correction Modal
    video_modal_title: 'Interaktive Biomechanische Korrekturanleitung',
    video_modal_subtitle: 'Die KI hat das Training wegen wiederholter Haltungsfehler gestoppt. Bitte sehen Sie die richtige Bewegung.',
    video_correct_posture: '✅ Korrekte Klinische Haltung',
    video_incorrect_posture: '❌ Ihre Fehlerhafte Haltung',
    video_key_takeaways: 'Wichtigste Biomechanische Grundregeln:',
    video_resume_btn: 'Verstanden — Training Fortsetzen',
    video_demonstration: 'Visuelle Kinematische Bewegungsführung',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  currentLangInfo: LanguageOption;
  getSpeechLocale: () => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('physio_lang') as Language;
      if (saved && TRANSLATIONS[saved]) return saved;
    } catch {}
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('physio_lang', lang);
    } catch {}
  };

  const currentLangInfo =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  const t = (key: string): string => {
    return TRANSLATIONS[language]?.[key] || TRANSLATIONS['en']?.[key] || key;
  };

  const getSpeechLocale = (): string => {
    return currentLangInfo.speechLocale;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        currentLangInfo,
        getSpeechLocale,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
