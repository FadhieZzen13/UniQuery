import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Plus, Menu, X, GraduationCap, LogOut, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { notificationsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

interface NavbarProps {
  onMenuClick: () => void;
  isMenuOpen: boolean;
  onAskQuestion: () => void;
}

const Navbar = ({ onMenuClick, isMenuOpen, onAskQuestion }: NavbarProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const loadNotifications = async () => {
    if (!user || notifLoading) return;
    setNotifLoading(true);
    try {
      const result = await notificationsApi.getAll({ limit: 20, offset: 0 });
      setNotifications(result.notifications || []);
    } catch (error) {
      console.error("Failed to load notifications", error);
    } finally {
      setNotifLoading(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, read_at: new Date().toISOString() } : item))
      );
    } catch (error) {
      console.error("Failed to mark notification read", error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  const displayName = user?.name || user?.email?.split("@")[0] || "User";
  const avatarUrl = user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`;
  const unreadCount = notifications.filter((item) => !item.read_at).length;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-16 items-center gap-4 px-4">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold text-primary">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="hidden sm:inline text-lg">UniQuery</span>
        </Link>

        {/* Search bar */}
        <div className="flex-1 max-w-xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted/50 border-muted focus:bg-card"
            />
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-3">
          <DropdownMenu onOpenChange={(open) => open && loadNotifications()}>
            <DropdownMenuTrigger asChild>
              <button
                className="relative flex items-center justify-center w-9 h-9 rounded-full border border-border hover:bg-muted/50"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 text-[10px] bg-destructive text-destructive-foreground rounded-full px-1">
                    {unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-h-[60vh] overflow-auto">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">Notifications</p>
                <p className="text-xs text-muted-foreground">
                  {notifLoading ? "Loading..." : `${notifications.length} total`}
                </p>
              </div>
              <DropdownMenuSeparator />
              {!notifLoading && notifications.length === 0 && (
                <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                  No notifications yet
                </div>
              )}
              {notifications.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  onClick={() => handleMarkRead(item.id)}
                  className={cn("flex flex-col items-start gap-1", !item.read_at && "bg-muted/40")}
                >
                  <span className="text-xs font-semibold text-foreground">{item.type}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {item.payload ? JSON.stringify(item.payload) : ""}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            onClick={onAskQuestion}
            size="sm"
            className="hidden sm:flex gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Ask Question
          </Button>
          <Button
            onClick={onAskQuestion}
            size="icon"
            className="sm:hidden"
            aria-label="Ask Question"
          >
            <Plus className="h-4 w-4" />
          </Button>

          {/* User avatar with dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 focus:outline-none">
                <div className="hidden sm:flex flex-col items-end text-xs">
                  <span className="font-medium text-foreground">{displayName.split(' ')[0]}</span>
                  <span className="text-success font-semibold">{user?.reputation || 0} pts</span>
                </div>
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-9 h-9 rounded-full ring-2 ring-primary/20 hover:ring-primary/40 transition-all"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{displayName}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                {user?.major && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {user.major} • {user.year}
                  </p>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/moderation")}>Moderation</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/admin")}>Admin</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
