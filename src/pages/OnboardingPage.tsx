import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, User, BookOpen, Calendar, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const majors = [
  "Computer Science",
  "Software Engineering",
  "Information Technology",
  "Data Science",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Chemical Engineering",
  "Business Administration",
  "Economics",
  "Finance",
  "Accounting",
  "Marketing",
  "Psychology",
  "Biology",
  "Chemistry",
  "Physics",
  "Mathematics",
  "English Literature",
  "History",
  "Political Science",
  "Sociology",
  "Communications",
  "Nursing",
  "Medicine",
  "Law",
  "Architecture",
  "Art & Design",
  "Music",
  "Education",
  "Other",
];

const years = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "5th Year",
  "Graduate Student",
  "PhD Student",
  "Alumni",
];

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { completeOnboarding, user } = useAuth();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [major, setMajor] = useState("");
  const [year, setYear] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = () => {
    if (step === 1 && !name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your full name.",
        variant: "destructive",
      });
      return;
    }
    if (step === 2 && !major) {
      toast({
        title: "Major required",
        description: "Please select your major or faculty.",
        variant: "destructive",
      });
      return;
    }
    setStep(step + 1);
  };

  const handleComplete = async () => {
    if (!year) {
      toast({
        title: "Year required",
        description: "Please select your current year.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await completeOnboarding(name, major, year);
      toast({
        title: "Welcome to UniQuery!",
        description: "Your profile has been set up successfully.",
      });
      navigate("/dashboard");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to complete onboarding",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="h-7 w-7" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Complete Your Profile</h1>
          <p className="text-muted-foreground mt-1">Let's get to know you better</p>
        </div>

        {/* Progress indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s === step
                  ? "w-8 bg-primary"
                  : s < step
                  ? "w-4 bg-primary/60"
                  : "w-4 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Form Card */}
        <div className="bg-card rounded-xl shadow-lg border border-border p-6 animate-fade-in">
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">What's your name?</h2>
                  <p className="text-sm text-muted-foreground">This will be displayed on your profile</p>
                </div>
              </div>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className="text-lg py-6"
                autoFocus
              />
              <Button onClick={handleNext} className="w-full" size="lg">
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">What's your major?</h2>
                  <p className="text-sm text-muted-foreground">Select your field of study</p>
                </div>
              </div>
              <Select value={major} onValueChange={setMajor}>
                <SelectTrigger className="text-lg py-6">
                  <SelectValue placeholder="Select your major" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {majors.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleNext} className="flex-1">
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">What year are you in?</h2>
                  <p className="text-sm text-muted-foreground">Your current academic year</p>
                </div>
              </div>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="text-lg py-6">
                  <SelectValue placeholder="Select your year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  Back
                </Button>
                <Button 
                  onClick={handleComplete} 
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Setting up..." : "Complete Setup"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Summary preview */}
        {(name || major || year) && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg animate-fade-in">
            <p className="text-sm text-muted-foreground mb-2">Your Profile Preview</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                {name ? name.charAt(0).toUpperCase() : "?"}
              </div>
              <div>
                <p className="font-medium text-foreground">{name || "Your Name"}</p>
                <p className="text-sm text-muted-foreground">
                  {[major, year].filter(Boolean).join(" • ") || "Major • Year"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingPage;
