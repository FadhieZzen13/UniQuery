import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Users } from "lucide-react";

interface Course {
  id: string;
  code: string;
  title: string;
  status: string;
}

interface Enrollment {
  id: string;
  role: string;
  user_id: string;
  institutional_email: string;
  full_name?: string | null;
}

// Manage who is in a course. Pick a course, then add/remove members.
const AdminMembers = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("STUDENT");
  const [isAdding, setIsAdding] = useState(false);

  const courseOptions = useMemo(
    () => courses.filter((c) => c.status !== "ARCHIVED"),
    [courses]
  );

  const loadCourses = async () => {
    try {
      const result = await adminApi.listCourses();
      setCourses(result);
      if (!selectedCourseId && result.length > 0) {
        setSelectedCourseId(result[0].id);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load courses.",
        variant: "destructive",
      });
    }
  };

  const loadEnrollments = async (courseId: string) => {
    if (!courseId) return;
    try {
      const result = await adminApi.listEnrollments(courseId);
      setEnrollments(result);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load members.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedCourseId) loadEnrollments(selectedCourseId);
  }, [selectedCourseId]);

  const handleAdd = async () => {
    if (!selectedCourseId || !email.trim()) {
      toast({
        title: "Missing info",
        description: "Pick a course and enter a user email.",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    try {
      await adminApi.createEnrollment({
        courseId: selectedCourseId,
        userEmail: email.trim(),
        role: role as "STUDENT" | "TA" | "FACULTY",
      });
      setEmail("");
      toast({ title: "Member added" });
      await loadEnrollments(selectedCourseId);
    } catch (error) {
      toast({
        title: "Add failed",
        description: error instanceof Error ? error.message : "Failed to add member",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (enrollmentId: string) => {
    try {
      await adminApi.deleteEnrollment(enrollmentId);
      toast({ title: "Member removed" });
      await loadEnrollments(selectedCourseId);
    } catch (error) {
      toast({
        title: "Remove failed",
        description: error instanceof Error ? error.message : "Failed to remove member",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <CardTitle>Members</CardTitle>
        </div>
        <select
          className="text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(e.target.value)}
        >
          {courseOptions.length === 0 && <option value="">No courses</option>}
          {courseOptions.map((course) => (
            <option key={course.id} value={course.id}>
              {course.code} • {course.title}
            </option>
          ))}
        </select>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_150px_auto]">
          <Input
            placeholder="User email (e.g. student@uni.edu)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select
            className="text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="STUDENT">Student</option>
            <option value="TA">TA</option>
            <option value="FACULTY">Faculty</option>
          </select>
          <Button onClick={handleAdd} disabled={isAdding || !selectedCourseId}>
            {isAdding ? "Adding..." : "Add member"}
          </Button>
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-muted/40 px-3 py-2 text-xs uppercase text-muted-foreground">
            Members in this course
          </div>
          <div className="divide-y divide-border">
            {enrollments.length === 0 && (
              <div className="px-3 py-3 text-sm text-muted-foreground">No members yet.</div>
            )}
            {enrollments.map((enrollment) => (
              <div
                key={enrollment.id}
                className="px-3 py-2 text-sm flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <span className="font-medium text-foreground">
                    {enrollment.institutional_email}
                  </span>
                  <span className="text-muted-foreground"> • {enrollment.role}</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleRemove(enrollment.id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminMembers;
