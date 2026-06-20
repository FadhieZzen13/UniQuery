import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, ArrowRight } from "lucide-react";
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
import { coursesApi } from "@/lib/api";

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

interface Course {
  id: string;
  code: string;
  title: string;
}

const TOTAL_STEPS = 4;

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { completeOnboarding, user } = useAuth();
  const courseOnly = Boolean(user?.onboardingCompleted && user?.needsCourseEnrollment);
  const [step, setStep] = useState(courseOnly ? 4 : 1);
  const [name, setName] = useState(user?.name ?? "");
  const [major, setMajor] = useState(user?.major ?? "");
  const [year, setYear] = useState(user?.year ?? "");
  const [courseId, setCourseId] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (step !== 4) return;

    const loadCourses = async () => {
      setCoursesLoading(true);
      try {
        const available = await coursesApi.getAvailable();
        setCourses(available);
        if (available.length === 1) {
          setCourseId(available[0].id);
        }
      } catch (error) {
        toast({
          title: "Could not load courses",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setCoursesLoading(false);
      }
    };

    loadCourses();
  }, [step]);

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
    if (step === 3 && !year) {
      toast({
        title: "Year required",
        description: "Please select your current year.",
        variant: "destructive",
      });
      return;
    }
    setStep(step + 1);
  };

  const handleComplete = async () => {
    if (!courseId) {
      toast({
        title: "Course required",
        description: "Please select a course to join.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await completeOnboarding(
        name.trim() || user?.name || "Student",
        major || user?.major || "Other",
        year || user?.year || "1st Year",
        courseId
      );
      toast({
        title: "Welcome to UniQuery!",
        description: "Your profile has been set up and you've joined your course.",
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
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Set up your profile</h1>
          <p className="text-muted-foreground text-sm mt-1">Just a few quick steps</p>
        </div>

        {!courseOnly && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
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
        )}

        <div className="bg-white rounded-lg border border-border p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="mb-4">
                <h2 className="font-semibold text-foreground">What's your name?</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Displayed on your profile</p>
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
              <div className="mb-4">
                <h2 className="font-semibold text-foreground">What's your major?</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Your field of study</p>
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
              <div className="mb-4">
                <h2 className="font-semibold text-foreground">What year are you in?</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Your current academic year</p>
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
                <Button onClick={handleNext} className="flex-1">
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="mb-4">
                <h2 className="font-semibold text-foreground">Join a course</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Pick the course where you'll ask and answer questions
                </p>
              </div>

              {coursesLoading ? (
                <p className="text-sm text-muted-foreground text-center py-6">Loading courses...</p>
              ) : courses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No courses are available yet. Ask your administrator to add one.
                </p>
              ) : (
                <Select value={courseId} onValueChange={setCourseId}>
                  <SelectTrigger className="text-lg py-6">
                    <SelectValue placeholder="Select your course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.code} — {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={handleComplete}
                  className="flex-1"
                  disabled={isSubmitting || coursesLoading || courses.length === 0}
                >
                  {isSubmitting ? "Setting up..." : "Complete Setup"}
                </Button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default OnboardingPage;
