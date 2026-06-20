import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Settings, Key, Building, BookOpen, Users } from "lucide-react";

interface Institution {
  id: string;
  name: string;
  domain: string;
  created_at: string;
}

interface Course {
  id: string;
  institution_id: string;
  faculty_id?: string | null;
  code: string;
  title: string;
  status: string;
}

interface Enrollment {
  id: string;
  role: string;
  created_at: string;
  user_id: string;
  institutional_email: string;
  full_name?: string | null;
  display_name?: string | null;
}

const Admin = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");

  const [institutionName, setInstitutionName] = useState("");
  const [institutionDomain, setInstitutionDomain] = useState("");

  const [courseCode, setCourseCode] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [courseFacultyId, setCourseFacultyId] = useState("");

  const [enrollEmail, setEnrollEmail] = useState("");
  const [enrollRole, setEnrollRole] = useState("STUDENT");

  const courseOptions = useMemo(
    () => courses.filter((c) => c.status !== "ARCHIVED"),
    [courses]
  );

  const loadInstitutions = async () => {
    try {
      const result = await adminApi.listInstitutions();
      setInstitutions(result);
      if (!selectedInstitutionId && result.length > 0) {
        setSelectedInstitutionId(result[0].id);
      }
    } catch (error) {
      console.error("Failed to load institutions", error);
      toast({
        title: "Error",
        description: "Failed to load institutions.",
        variant: "destructive",
      });
    }
  };

  const loadCourses = async (institutionId: string) => {
    if (!institutionId) return;
    try {
      const result = await adminApi.listCourses(institutionId);
      setCourses(result);
      if (!selectedCourseId && result.length > 0) {
        setSelectedCourseId(result[0].id);
      }
    } catch (error) {
      console.error("Failed to load courses", error);
      toast({
        title: "Error",
        description: "Failed to load courses.",
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
      console.error("Failed to load enrollments", error);
      toast({
        title: "Error",
        description: "Failed to load enrollments.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadInstitutions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedInstitutionId) {
      loadCourses(selectedInstitutionId);
    }
  }, [selectedInstitutionId]);

  useEffect(() => {
    if (selectedCourseId) {
      loadEnrollments(selectedCourseId);
    }
  }, [selectedCourseId]);

  const handleCreateInstitution = async () => {
    if (!institutionName.trim() || !institutionDomain.trim()) {
      toast({
        title: "Missing info",
        description: "Name and domain are required.",
        variant: "destructive",
      });
      return;
    }

    try {
      await adminApi.createInstitution({
        name: institutionName.trim(),
        domain: institutionDomain.trim(),
      });
      setInstitutionName("");
      setInstitutionDomain("");
      toast({ title: "Institution created" });
      await loadInstitutions();
    } catch (error) {
      toast({
        title: "Create failed",
        description: error instanceof Error ? error.message : "Failed to create institution",
        variant: "destructive",
      });
    }
  };

  const handleCreateCourse = async () => {
    if (!selectedInstitutionId || !courseCode.trim() || !courseTitle.trim()) {
      toast({
        title: "Missing info",
        description: "Institution, code, and title are required.",
        variant: "destructive",
      });
      return;
    }

    try {
      await adminApi.createCourse({
        institutionId: selectedInstitutionId,
        code: courseCode.trim(),
        title: courseTitle.trim(),
        facultyId: courseFacultyId.trim() || undefined,
      });
      setCourseCode("");
      setCourseTitle("");
      setCourseFacultyId("");
      toast({ title: "Course created" });
      await loadCourses(selectedInstitutionId);
    } catch (error) {
      toast({
        title: "Create failed",
        description: error instanceof Error ? error.message : "Failed to create course",
        variant: "destructive",
      });
    }
  };

  const handleEnroll = async () => {
    if (!selectedCourseId || !enrollEmail.trim()) {
      toast({
        title: "Missing info",
        description: "Course and user email are required.",
        variant: "destructive",
      });
      return;
    }

    try {
      await adminApi.createEnrollment({
        courseId: selectedCourseId,
        userEmail: enrollEmail.trim(),
        role: enrollRole as "STUDENT" | "TA" | "FACULTY",
      });
      setEnrollEmail("");
      toast({ title: "Enrollment created" });
      await loadEnrollments(selectedCourseId);
    } catch (error) {
      toast({
        title: "Enroll failed",
        description: error instanceof Error ? error.message : "Failed to enroll user",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEnrollment = async (enrollmentId: string) => {
    try {
      await adminApi.deleteEnrollment(enrollmentId);
      toast({ title: "Enrollment removed" });
      await loadEnrollments(selectedCourseId);
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to remove enrollment",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
        isMenuOpen={isSidebarOpen}
        onAskQuestion={() => undefined}
      />

      <main className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage institutions, courses, enrollments, and global configurations.</p>
        </div>

        <Tabs defaultValue="institutions" className="space-y-6">
          <TabsList className="bg-muted w-full justify-start overflow-x-auto">
            <TabsTrigger value="institutions" className="gap-2">
              <Building className="w-4 h-4" /> Institutions
            </TabsTrigger>
            <TabsTrigger value="courses" className="gap-2">
              <BookOpen className="w-4 h-4" /> Courses
            </TabsTrigger>
            <TabsTrigger value="enrollments" className="gap-2">
              <Users className="w-4 h-4" /> Enrollments
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" /> Settings
            </TabsTrigger>
            <TabsTrigger value="apikeys" className="gap-2">
              <Key className="w-4 h-4" /> API Keys
            </TabsTrigger>
          </TabsList>

          <TabsContent value="institutions">
            <Card>
          <CardHeader>
            <CardTitle>Institutions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Institution name"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
              />
              <Input
                placeholder="Domain (e.g. uni.edu)"
                value={institutionDomain}
                onChange={(e) => setInstitutionDomain(e.target.value)}
              />
              <Button onClick={handleCreateInstitution}>Create</Button>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/40 px-3 py-2 text-xs uppercase text-muted-foreground">Existing</div>
              <div className="divide-y divide-border">
                {institutions.length === 0 && (
                  <div className="px-3 py-3 text-sm text-muted-foreground">No institutions yet.</div>
                )}
                {institutions.map((inst) => (
                  <div key={inst.id} className="px-3 py-2 text-sm">
                    <span className="font-medium text-foreground">{inst.name}</span>
                    <span className="text-muted-foreground"> • {inst.domain}</span>
                  </div>
                ))}
              </div>
            </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="courses">
          <Card>
          <CardHeader>
            <CardTitle>Courses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                className="text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={selectedInstitutionId}
                onChange={(e) => setSelectedInstitutionId(e.target.value)}
              >
                {institutions.length === 0 && <option value="">No institutions</option>}
                {institutions.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
              <Button variant="outline" onClick={() => loadCourses(selectedInstitutionId)}>
                Refresh
              </Button>
            </div>

            <div className="grid sm:grid-cols-3 gap-2">
              <Input
                placeholder="Course code (e.g. CS101)"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
              />
              <Input
                placeholder="Course title"
                value={courseTitle}
                onChange={(e) => setCourseTitle(e.target.value)}
              />
              <Input
                placeholder="Faculty ID (optional)"
                value={courseFacultyId}
                onChange={(e) => setCourseFacultyId(e.target.value)}
              />
            </div>
            <Button onClick={handleCreateCourse}>Create Course</Button>

            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/40 px-3 py-2 text-xs uppercase text-muted-foreground">Existing</div>
              <div className="divide-y divide-border">
                {courses.length === 0 && (
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
        </TabsContent>

        <TabsContent value="enrollments">
          <Card>
          <CardHeader>
            <CardTitle>Enrollments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
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
              <Button variant="outline" onClick={() => loadEnrollments(selectedCourseId)}>
                Refresh
              </Button>
            </div>

            <div className="grid sm:grid-cols-[1fr_160px_auto] gap-2">
              <Input
                placeholder="User email (e.g. student@uni.edu)"
                value={enrollEmail}
                onChange={(e) => setEnrollEmail(e.target.value)}
              />
              <select
                className="text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={enrollRole}
                onChange={(e) => setEnrollRole(e.target.value)}
              >
                <option value="STUDENT">Student</option>
                <option value="TA">TA</option>
                <option value="FACULTY">Faculty</option>
              </select>
              <Button onClick={handleEnroll}>Enroll</Button>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/40 px-3 py-2 text-xs uppercase text-muted-foreground">Existing</div>
              <div className="divide-y divide-border">
                {enrollments.length === 0 && (
                  <div className="px-3 py-3 text-sm text-muted-foreground">No enrollments yet.</div>
                )}
                {enrollments.map((enrollment) => (
                  <div key={enrollment.id} className="px-3 py-2 text-sm flex items-center justify-between">
                    <div>
                      <span className="font-medium text-foreground">{enrollment.institutional_email}</span>
                      <span className="text-muted-foreground"> • {enrollment.role}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteEnrollment(enrollment.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Global Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center text-muted-foreground bg-muted/20 border border-dashed border-border rounded-lg">
                <Settings className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p className="font-medium text-foreground">Settings configuration coming soon.</p>
                <p className="text-sm">This module is scheduled for backend integration.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="apikeys">
          <Card>
            <CardHeader>
              <CardTitle>Developer API Keys</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center text-muted-foreground bg-muted/20 border border-dashed border-border rounded-lg">
                <Key className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p className="font-medium text-foreground">API Key management coming soon.</p>
                <p className="text-sm">This module is scheduled for backend integration.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </main>
    </div>
  );
};

export default Admin;
