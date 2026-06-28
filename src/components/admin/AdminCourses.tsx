import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { BookOpen } from "lucide-react";

interface Course {
  id: string;
  code: string;
  title: string;
  status: string;
}

// Course management for a single institution — the server attaches the admin's own
// institution, so there's no institution picker to reason about.
const AdminCourses = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const result = await adminApi.listCourses();
      setCourses(result);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load courses.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!code.trim() || !title.trim()) {
      toast({
        title: "Missing info",
        description: "Course code and title are required.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      await adminApi.createCourse({ code: code.trim(), title: title.trim() });
      setCode("");
      setTitle("");
      toast({ title: "Course created" });
      await load();
    } catch (error) {
      toast({
        title: "Create failed",
        description: error instanceof Error ? error.message : "Failed to create course",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <CardTitle>Courses</CardTitle>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            placeholder="Course code (e.g. CS101)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Input
            placeholder="Course title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? "Adding..." : "Add course"}
          </Button>
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-muted/40 px-3 py-2 text-xs uppercase text-muted-foreground">
            Existing courses
          </div>
          <div className="divide-y divide-border">
            {isLoading && (
              <div className="px-3 py-3 text-sm text-muted-foreground">Loading...</div>
            )}
            {!isLoading && courses.length === 0 && (
              <div className="px-3 py-3 text-sm text-muted-foreground">No courses yet.</div>
            )}
            {courses.map((course) => (
              <div key={course.id} className="px-3 py-2 text-sm">
                <span className="font-medium text-foreground">{course.code}</span>
                <span className="text-muted-foreground"> • {course.title} ({course.status})</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminCourses;
