import { Link } from "react-router-dom";
import { GraduationCap, MessageCircle, Users, Award, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/10" />
        
        <nav className="relative container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="h-6 w-6" />
            </div>
            <span className="text-xl font-bold text-foreground">UniQuery</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </nav>

        <div className="relative container mx-auto px-4 py-20 lg:py-32 text-center">
          <div className="animate-fade-in">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Your Campus Community
            </span>
            
            <h1 className="text-4xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              Get Answers from<br />
              <span className="text-primary">Fellow Students</span>
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              UniQuery is your centralized campus Q&A forum. Ask questions about academics, 
              administration, hostel life, and more. Get help from students who've been there.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/auth">
                <Button size="lg" className="gap-2">
                  Start Asking Questions
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button size="lg" variant="outline">
                  Browse Questions
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 animate-fade-in">
            <h2 className="text-3xl font-bold text-foreground mb-3">
              Everything You Need
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              A platform built by students, for students. Get reliable answers from your campus community.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-card rounded-xl p-6 border border-border shadow-sm animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <MessageCircle className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Ask & Answer</h3>
              <p className="text-sm text-muted-foreground">
                Post questions and help fellow students by sharing your knowledge and experiences.
              </p>
            </div>

            <div className="bg-card rounded-xl p-6 border border-border shadow-sm animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-success" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Community Verified</h3>
              <p className="text-sm text-muted-foreground">
                The best answers are voted up and verified, so you can trust the information.
              </p>
            </div>

            <div className="bg-card rounded-xl p-6 border border-border shadow-sm animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center mb-4">
                <Award className="h-6 w-6 text-accent-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Earn Reputation</h3>
              <p className="text-sm text-muted-foreground">
                Build your reputation by helping others. Top contributors get recognized.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-3">
              All Topics Covered
            </h2>
            <p className="text-muted-foreground">
              From academics to student life, find answers for everything.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { name: "Academic", desc: "Courses, exams, projects", color: "bg-primary/10 text-primary" },
              { name: "Administrative", desc: "Forms, deadlines, policies", color: "bg-destructive/10 text-destructive" },
              { name: "Hostel & Facilities", desc: "Housing, WiFi, amenities", color: "bg-success/10 text-success" },
              { name: "Student Life", desc: "Events, clubs, tips", color: "bg-accent text-accent-foreground" },
            ].map((cat, i) => (
              <div
                key={cat.name}
                className="bg-card rounded-lg p-4 border border-border text-center hover:shadow-md transition-shadow cursor-pointer animate-fade-in"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className={`inline-flex w-10 h-10 rounded-lg ${cat.color} items-center justify-center mb-3`}>
                  <GraduationCap className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-foreground">{cat.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{cat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Ready to Join the Community?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Sign up with your university email and start getting answers today.
          </p>
          <Link to="/auth">
            <Button size="lg" className="gap-2">
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">UniQuery</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 UniQuery. Built for students, by students.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
