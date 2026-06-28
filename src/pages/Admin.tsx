import { useState } from "react";
import Navbar from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldAlert, BookOpen, Users } from "lucide-react";
import AdminFlags from "@/components/admin/AdminFlags";
import AdminCourses from "@/components/admin/AdminCourses";
import AdminMembers from "@/components/admin/AdminMembers";

// Admin hub, split into three focused modules:
//   • Flags   — resolve reported content across every course (the main admin job)
//   • Courses — create/list courses for this institution
//   • Members — enroll/remove users per course
// Institution selection is implicit (single-institution) and the old non-functional
// Settings / API Keys placeholders were removed.
const Admin = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
          <p className="text-sm text-muted-foreground">
            Triage flagged content and manage courses and members.
          </p>
        </div>

        <Tabs defaultValue="flags" className="space-y-6">
          <TabsList className="bg-muted w-full justify-start overflow-x-auto">
            <TabsTrigger value="flags" className="gap-2">
              <ShieldAlert className="w-4 h-4" /> Flags
            </TabsTrigger>
            <TabsTrigger value="courses" className="gap-2">
              <BookOpen className="w-4 h-4" /> Courses
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-2">
              <Users className="w-4 h-4" /> Members
            </TabsTrigger>
          </TabsList>

          <TabsContent value="flags">
            <AdminFlags />
          </TabsContent>
          <TabsContent value="courses">
            <AdminCourses />
          </TabsContent>
          <TabsContent value="members">
            <AdminMembers />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
