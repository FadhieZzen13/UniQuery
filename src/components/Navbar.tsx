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
    <header className="sticky top-0 z-50 w-full bg-white border-b border-border">
      <div className="container flex h-14 items-center gap-4 px-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 -ml-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Link to="/dashboard" className="flex items-center gap-2 text-primary font-semibold shrink-0">
          <GraduationCap className="h-[18px] w-[18px]" />
          <span className="hidden sm:inline text-[15px] tracking-tight">UniQuery</span>
        </Link>

        <div className="flex-1 max-w-sm mx-auto">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm bg-muted/50 border-transparent focus-visible:border-border focus-visible:bg-white focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <DropdownMenu onOpenChange={(open) => open && loadNotifications()}>
            <DropdownMenuTrigger asChild>
              <button
                className="relative p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-h-[60vh] overflow-auto">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-sm font-medium">Notifications</p>
                <p className="text-xs text-muted-foreground">
                  {notifLoading ? "Loading..." : `${notifications.length} total`}
                </p>
              </div>
              {!notifLoading && notifications.length === 0 && (
                <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                  No notifications yet
                </div>
              )}
              {notifications.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  onClick={() => handleMarkRead(item.id)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 px-3 py-2.5 cursor-pointer",
                    !item.read_at && "bg-accent/30"
                  )}
                >
                  <span className="text-xs font-medium text-foreground">{item.type}</span>
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
            className="hidden sm:flex h-8 text-xs gap-1 px-3"
          >
            <Plus className="h-3.5 w-3.5" />
            Ask
          </Button>
          <button
            onClick={onAskQuestion}
            className="sm:hidden p-1.5 rounded-md bg-primary text-white hover:bg-primary/90 transition-colors"
            aria-label="Ask Question"
          >
            <Plus className="h-4 w-4" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 focus:outline-none ml-1 rounded-md p-1 hover:bg-muted/50 transition-colors">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-medium text-foreground leading-none">
                    {displayName.split(" ")[0]}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-none mt-0.5">
                    {user?.reputation ?? 0} pts
                  </span>
                </div>
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-7 h-7 rounded-full border border-border bg-muted"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-foreground">{displayName}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{user?.email}</p>
                {user?.major && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {user.major}{user.year ? ` · ${user.year}` : ""}
                  </p>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/moderation")}>Moderation</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/admin")}>Admin</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive focus:bg-destructive/5"
              >
                <LogOut className="mr-2 h-3.5 w-3.5" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
