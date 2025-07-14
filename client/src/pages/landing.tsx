import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, MessageSquare, Mic, Zap } from "lucide-react";
import { SiGoogle, SiGithub } from "react-icons/si";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Bot className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-slate-800 dark:text-slate-200 mb-4">
            Asistente de chat Rasa AIAsistente de chat Rasa AI
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 mb-8 max-w-2xl mx-auto">
            Experimenta el futuro de la conversación con nuestro asistente avanzado de IA. Obtén respuestas instantáneas, soluciones creativas y perspectivas inteligentes.
          </p>
          <div className="flex flex-col space-y-4 max-w-md mx-auto">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white px-8 py-4 text-lg rounded-full flex items-center justify-center"
              onClick={() => window.location.href = '/api/auth/google'}
            >
              <SiGoogle className="w-5 h-5 mr-3" />
              Continue with Google
            </Button>
            
            <Button 
              size="lg" 
              variant="outline"
              className="border-2 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 px-8 py-4 text-lg rounded-full flex items-center justify-center"
              onClick={() => window.location.href = '/api/auth/github'}
            >
              <SiGithub className="w-5 h-5 mr-3" />
              Continue with GitHub
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <Card className="text-center p-6 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
                Intelligent Conversations
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Chat with our advanced AI that understands context and provides thoughtful responses.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mic className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
                Voice Input
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Speak naturally and let our AI transcribe and respond to your voice messages.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
                Real-time Streaming
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Get instant responses as the AI generates them, no waiting for complete answers.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-16">
          <p className="text-slate-500 dark:text-slate-400">
            Join thousands of users already experiencing the future of AI conversation
          </p>
        </div>
      </div>
    </div>
  );
}
