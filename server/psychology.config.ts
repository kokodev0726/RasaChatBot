import dotenv from 'dotenv';

dotenv.config();

export interface PsychologyConfig {
  // Model settings
  modelName: string;
  temperature: number;
  maxTokens: number;
  
  // Psychology agent settings
  enablePersonalizedQuestions: boolean;
  enableProgressTracking: boolean;
  enableEmotionAnalysis: boolean;
  
  // Question settings
  predefinedQuestions: string[];
  questionCategories: Record<string, string[]>;
  
  // Prompt templates
  systemPrompt: string;
  personalizedQuestionPrompt: string;
  emotionAnalysisPrompt: string;
  progressAssessmentPrompt: string;
}

export const psychologyConfig: PsychologyConfig = {
  // Model settings
  modelName: "gpt-4o",
  temperature: 0.7,
  maxTokens: 2000,
  
  // Psychology agent settings
  enablePersonalizedQuestions: true,
  enableProgressTracking: true,
  enableEmotionAnalysis: true,
  
  // Predefined questions
  predefinedQuestions: [
    "¿Qué te trajo a la consulta hoy?",
    "¿Puedes contarme un poco sobre tu vida antes de que comenzaras a sentirte como te sientes ahora?",
    "¿Cuáles son los principales problemas que estás enfrentando actualmente?",
    "¿Cómo has estado manejando el estrés o las dificultades en tu vida?",
    "¿Tienes algún apoyo social (amigos, familia, pareja) para manejar tus problemas?",
    "¿Cómo describirías tu relación con tu familia?",
    "¿Has tenido experiencias pasadas que crees que podrían estar afectando tu bienestar hoy?",
    "¿Tienes antecedentes familiares de problemas de salud mental?",
    "¿Cuánto te afectan las emociones que experimentas día a día?",
    "¿Tienes alguna meta específica que te gustaría alcanzar con la terapia?",
    "¿Has notado algún patrón en tus pensamientos o comportamientos que crees que afecta tu bienestar?",
    "¿Cómo sueles reaccionar cuando te enfrentas a situaciones difíciles o conflictivas?",
    "¿Qué emociones sueles experimentar con más frecuencia? ¿Cómo las manejas?",
    "¿Cómo ha cambiado tu relación con los demás desde que comenzamos a trabajar juntos?",
    "¿Qué actividades o relaciones te hacen sentir más conectado contigo mismo/a?",
    "¿Te resulta difícil perdonarte a ti mismo/a o a los demás? ¿Por qué?",
    "¿En qué situaciones sientes más ansiedad o estrés?",
    "¿Tienes pensamientos recurrentes que te resultan difíciles de controlar?",
    "¿Cómo te has sentido en cuanto a tu autoimagen o autoestima?",
    "¿Qué cosas te motivan a seguir adelante, incluso en los momentos difíciles?"
  ],
  
  // Question categories for better organization
  questionCategories: {
    "initial_assessment": [
      "¿Qué te trajo a la consulta hoy?",
      "¿Puedes contarme un poco sobre tu vida antes de que comenzaras a sentirte como te sientes ahora?",
      "¿Cuáles son los principales problemas que estás enfrentando actualmente?"
    ],
    "coping_mechanisms": [
      "¿Cómo has estado manejando el estrés o las dificultades en tu vida?",
      "¿Cómo sueles reaccionar cuando te enfrentas a situaciones difíciles o conflictivas?",
      "¿Qué emociones sueles experimentar con más frecuencia? ¿Cómo las manejas?"
    ],
    "social_support": [
      "¿Tienes algún apoyo social (amigos, familia, pareja) para manejar tus problemas?",
      "¿Cómo describirías tu relación con tu familia?",
      "¿Cómo ha cambiado tu relación con los demás desde que comenzamos a trabajar juntos?"
    ],
    "past_experiences": [
      "¿Has tenido experiencias pasadas que crees que podrían estar afectando tu bienestar hoy?",
      "¿Tienes antecedentes familiares de problemas de salud mental?"
    ],
    "emotional_wellbeing": [
      "¿Cuánto te afectan las emociones que experimentas día a día?",
      "¿En qué situaciones sientes más ansiedad o estrés?",
      "¿Tienes pensamientos recurrentes que te resultan difíciles de controlar?"
    ],
    "goals_and_motivation": [
      "¿Tienes alguna meta específica que te gustaría alcanzar con la terapia?",
      "¿Qué cosas te motivan a seguir adelante, incluso en los momentos difíciles?"
    ],
    "self_awareness": [
      "¿Has notado algún patrón en tus pensamientos o comportamientos que crees que afecta tu bienestar?",
      "¿Qué actividades o relaciones te hacen sentir más conectado contigo mismo/a?",
      "¿Te resulta difícil perdonarte a ti mismo/a o a los demás? ¿Por qué?",
      "¿Cómo te has sentido en cuanto a tu autoimagen o autoestima?"
    ]
  },
  
  // Prompt templates
  systemPrompt: `Eres un psicólogo virtual especializado en terapia conversacional. Tu objetivo es ayudar a los usuarios a explorar sus pensamientos, emociones y experiencias de manera segura y empática.

DIRECTRICES PRINCIPALES:
- Mantén un tono cálido, empático y profesional
- Haz preguntas que inviten a la reflexión profunda
- Escucha activamente y muestra comprensión
- No des consejos médicos específicos ni diagnósticos
- Si detectas crisis o situaciones de emergencia, sugiere buscar ayuda profesional inmediata
- Utiliza las respuestas previas del usuario para personalizar tus preguntas
- Mantén la confidencialidad y crea un espacio seguro

ESTRATEGIAS DE PREGUNTAS:
1. Preguntas abiertas que inviten a la exploración
2. Preguntas de seguimiento basadas en respuestas previas
3. Preguntas que exploren emociones y pensamientos
4. Preguntas sobre patrones y comportamientos
5. Preguntas sobre relaciones y apoyo social

CONTEXTO DE LA CONVERSACIÓN:
{context}

Recuerda: Tu objetivo es facilitar la autoexploración y el autoconocimiento, no dar consejos directos.`,

  personalizedQuestionPrompt: `Basándote en la información del usuario y las respuestas previas, genera 3 preguntas personalizadas que sean relevantes para su situación específica.

INFORMACIÓN DEL USUARIO:
- Nombre: {userName}
- Edad: {userAge}
- Situación actual: {currentSituation}
- Respuestas previas: {previousResponses}
- Emociones mencionadas: {emotions}
- Relaciones importantes: {relationships}

GENERA 3 PREGUNTAS PERSONALIZADAS:
1. Una pregunta sobre su situación actual específica
2. Una pregunta sobre sus emociones o pensamientos
3. Una pregunta sobre sus relaciones o apoyo social

Formato de respuesta:
1. [Pregunta 1]
2. [Pregunta 2] 
3. [Pregunta 3]`,

  emotionAnalysisPrompt: `Analiza las emociones expresadas en el siguiente mensaje del usuario. Identifica las emociones principales y su intensidad.

MENSAJE: {message}

ANÁLISIS:
- Emociones principales: [lista de emociones]
- Intensidad: [baja/media/alta]
- Tono general: [positivo/neutral/negativo]
- Temas recurrentes: [temas mencionados]`,

  progressAssessmentPrompt: `Evalúa el progreso del usuario basándote en sus respuestas a lo largo del tiempo.

RESPUESTAS PREVIAS:
{previousResponses}

EVALUACIÓN:
- Áreas de mejora: [áreas donde ha mostrado progreso]
- Áreas de preocupación: [áreas que requieren más atención]
- Recomendaciones: [sugerencias para próximas sesiones]`
};

// Environment-specific overrides
export function getPsychologyConfig(): PsychologyConfig {
  const config = { ...psychologyConfig };
  
  // Override with environment variables if present
  if (process.env.PSYCHOLOGY_MODEL_NAME) {
    config.modelName = process.env.PSYCHOLOGY_MODEL_NAME;
  }
  
  if (process.env.PSYCHOLOGY_TEMPERATURE) {
    config.temperature = parseFloat(process.env.PSYCHOLOGY_TEMPERATURE);
  }
  
  if (process.env.PSYCHOLOGY_MAX_TOKENS) {
    config.maxTokens = parseInt(process.env.PSYCHOLOGY_MAX_TOKENS);
  }
  
  return config;
}
