import React from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, User, Zap, Settings as SettingsIcon } from 'lucide-react';
import LangChainSettings from '@/components/LangChainSettings';

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const handleBack = () => {
    setLocation('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                Settings
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Configure your chat experience
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User Profile */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  User Profile
                </CardTitle>
                <CardDescription>
                  Your account information and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Name
                  </label>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {user?.firstName && user?.lastName 
                      ? `${user.firstName} ${user.lastName}`
                      : 'Not set'
                    }
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Email
                  </label>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {user?.email || 'Not set'}
                  </p>
                </div>
                <Separator />
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Account Status
                  </label>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    Active
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* LangChain Settings */}
          <div className="lg:col-span-2">
            <LangChainSettings />
          </div>
        </div>
      </div>
    </div>
  );
} 