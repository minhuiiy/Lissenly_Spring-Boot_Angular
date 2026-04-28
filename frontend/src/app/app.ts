import { Component, OnInit, NgZone } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { RoomService } from './service/room.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { filter } from 'rxjs/operators';

declare var google: any;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  isInsideRoom = false;
  userData: any = null;
  activeTab: string = 'recent';
  isJoinDialogOpen = false;
  isUserMenuOpen = false;
  joinRoomCode = '';
  joinErrorMessage = '';
  isProfileDialogOpen = false;
  profileNameInput = '';
  appNotice = '';
  showAppNotice = false;
  private appNoticeTimer?: number;

  recentRooms: any[] = [];
  friendsList: any[] = [];
  exploreRooms: any[] = [];

  private readonly RECENT_ROOMS_KEY = 'lissenly_recent_rooms';
  private readonly RECENT_ROOM_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  private readonly RECENT_ROOM_LIMIT = 20;

  constructor(
    private roomService: RoomService, 
    public router: Router,
    private zone: NgZone 
  ) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      // Chỉ hiện landing page nếu ở trang chủ chính xác "/"
      this.isInsideRoom = event.url !== '/' && event.url !== '/index.html';
    });
  }

  ngOnInit() {
    // Cập nhật trạng thái phòng dựa trên URL hiện tại khi khởi tạo
    const currentUrl = this.router.url;
    this.isInsideRoom = currentUrl !== '/' && currentUrl !== '/index.html';

    this.loadExploreRooms();
    this.loadRecentRooms();

    console.log('Checking local session...');
    const savedUser = localStorage.getItem('user');
    
    if (savedUser) {
      try {
        this.userData = JSON.parse(savedUser);
        const uniqueUserId = this.userData.sub || this.userData.email || this.userData.picture || this.userData.given_name || this.userData.name || 'Guest';
        const displayName = this.userData.given_name || this.userData.name || this.userData.email || 'Guest';

        localStorage.setItem('lissenly_user_id', uniqueUserId);
        localStorage.setItem('lissenly_display_name', displayName);
        localStorage.setItem('lissenly_name', displayName);

        console.log('Session restored:', this.userData.email);
        return; // Dừng lại ở đây, không cần gọi Google GSI nữa nếu đã có session
      } catch (e) {
        console.error('Error parsing saved user', e);
        localStorage.removeItem('user');
      }
    }

    // Nếu chưa có session, mới khởi tạo Google GSI
    if (typeof google !== 'undefined') {
      google.accounts.id.initialize({
        client_id: '732962658436-kofreg71jnaveopbnc65hc1nc21u6tus.apps.googleusercontent.com',
        callback: (response: any) => this.handleCredentialResponse(response),
        use_fedcm_for_prompt: false, // Tắt FedCM để tránh lỗi trên localhost
        auto_select: false
      });
      this.renderGoogleButton();
    }
  }

  renderGoogleButton() {
    setTimeout(() => {
      const btnContainer = document.getElementById('google-btn-container');
      if (btnContainer) {
        google.accounts.id.renderButton(btnContainer, {
          theme: 'outline',
          size: 'medium',
          shape: 'pill',
          text: 'signin',
          locale: 'vi'
        });
        
        // Hiện gợi ý đăng nhập nhanh (One Tap) nếu nút bị lỗi hoặc người dùng chưa login
        google.accounts.id.prompt(); 
      }
    }, 500);
  }

  handleCredentialResponse(response: any) {
    this.zone.run(() => {
      const base64Url = response.credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));

      this.userData = JSON.parse(jsonPayload);
      localStorage.setItem('user', JSON.stringify(this.userData));

      const uniqueUserId = this.userData.sub || this.userData.email || this.userData.picture || this.userData.given_name || this.userData.name || 'Guest';
      const displayName = this.userData.given_name || this.userData.name || this.userData.email || 'Guest';

      localStorage.setItem('lissenly_user_id', uniqueUserId);
      localStorage.setItem('lissenly_display_name', displayName);
      localStorage.setItem('lissenly_name', displayName);
      console.log('User Data:', this.userData);
    });
  }

  toggleUserMenu() {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  closeUserMenu() {
    this.isUserMenuOpen = false;
  }

  editProfile() {
    const currentName = (localStorage.getItem('lissenly_display_name') || this.userData?.given_name || this.userData?.name || '').trim();
    this.profileNameInput = currentName;
    this.isProfileDialogOpen = true;
    this.closeUserMenu();
  }

  closeProfileDialog() {
    this.isProfileDialogOpen = false;
    this.profileNameInput = '';
  }

  saveProfile() {
    const cleanName = this.profileNameInput.trim();
    if (!cleanName) {
      this.showNotice('Tên hiển thị không được để trống.');
      return;
    }

    localStorage.setItem('lissenly_display_name', cleanName);
    localStorage.setItem('lissenly_name', cleanName);

    if (this.userData) {
      this.userData = { ...this.userData, given_name: cleanName, name: cleanName };
      localStorage.setItem('user', JSON.stringify(this.userData));
    }

    this.closeProfileDialog();
    this.showNotice('Đã cập nhật thông tin thành công.');
  }

  logout() {
    localStorage.removeItem('user');
    this.userData = null;
    this.closeUserMenu();
    location.reload(); // Tải lại để hiện lại nút đăng nhập
  }

  showNotice(message: string) {
    this.appNotice = message;
    this.showAppNotice = true;
    if (typeof window !== 'undefined') {
      window.clearTimeout(this.appNoticeTimer);
      this.appNoticeTimer = window.setTimeout(() => {
        this.showAppNotice = false;
      }, 2400);
    }
  }

  createNewRoom() {
    this.router.navigate(['/create']);
  }

  trackRoomVisit(room: { id: string; name?: string; host?: string; listeners?: number; genre?: string }) {
    if (!room?.id) return;

    const now = Date.now();
    const normalizedId = String(room.id).trim().toUpperCase();
    const current = this.readRecentRoomsStorage();
    const withoutCurrent = current.filter(item => item?.id !== normalizedId);

    const nextItem = {
      id: normalizedId,
      name: room.name || `Phòng ${normalizedId}`,
      host: room.host || 'Unknown',
      listeners: Number.isFinite(room.listeners) ? room.listeners : 0,
      genre: room.genre || 'Recent',
      lastVisitedAt: now
    };

    const nextList = [nextItem, ...withoutCurrent]
      .filter(item => now - item.lastVisitedAt <= this.RECENT_ROOM_TTL_MS)
      .slice(0, this.RECENT_ROOM_LIMIT);

    localStorage.setItem(this.RECENT_ROOMS_KEY, JSON.stringify(nextList));
    this.recentRooms = nextList;
  }

  openJoinRoomDialog() {
    this.isJoinDialogOpen = true;
  }

  closeJoinRoomDialog() {
    this.isJoinDialogOpen = false;
    this.joinRoomCode = '';
    this.joinErrorMessage = '';
  }

  joinRoomByCode() {
    const roomId = this.joinRoomCode.trim().replace(/[\s-]+/g, '');
    if (!roomId) {
      this.joinErrorMessage = 'Vui lòng nhập mã phòng trước khi tham gia.';
      return;
    }

    const normalizedRoomId = roomId.toUpperCase();
    const userId = localStorage.getItem('lissenly_user_id') || this.userData?.sub || this.userData?.email || this.userData?.given_name || 'Guest';
    this.roomService.joinRoom(normalizedRoomId, userId).subscribe({
      next: (response) => {
        const joinedRoomId = (response?.roomId || normalizedRoomId).toUpperCase();
        this.trackRoomVisit({
          id: joinedRoomId,
          name: response?.name || `Phòng ${joinedRoomId}`,
          host: response?.hostId || 'Unknown',
          listeners: Array.isArray(response?.members) ? response.members.length : 0,
          genre: 'Recent'
        });
        this.router.navigate(['/room', joinedRoomId]);
        this.closeJoinRoomDialog();
      },
      error: () => {
        this.joinErrorMessage = 'Không tìm thấy phòng. Vui lòng kiểm tra lại mã phòng hoặc thử quét QR.';
      }
    });
  }

  loginWithGoogle() {
    if (typeof google !== 'undefined') {
      // Đảm bảo khởi tạo lại nếu cần thiết trước khi hiện prompt
      google.accounts.id.initialize({
        client_id: '732962658436-kofreg71jnaveopbnc65hc1nc21u6tus.apps.googleusercontent.com',
        callback: (response: any) => this.handleCredentialResponse(response),
        use_fedcm_for_prompt: true
      });
      google.accounts.id.prompt();
    } else {
      this.showNotice('Hệ thống đăng nhập đang khởi tạo. Vui lòng thử lại sau vài giây.');
    }
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
    if (tab === 'explore') {
      this.loadExploreRooms();
    }
  }

  openRecentRoom(room: any) {
    if (!room?.id) return;
    this.trackRoomVisit(room);
    this.router.navigate(['/room', room.id]);
  }

  joinExploreRoom(room: any) {
    const roomId = room?.id;
    if (!roomId) return;
    this.trackRoomVisit(room);
    this.router.navigate(['/room', roomId]);
  }

  private loadRecentRooms() {
    const now = Date.now();
    const validRooms = this.readRecentRoomsStorage()
      .filter(item => now - item.lastVisitedAt <= this.RECENT_ROOM_TTL_MS)
      .slice(0, this.RECENT_ROOM_LIMIT);

    this.recentRooms = validRooms;
    localStorage.setItem(this.RECENT_ROOMS_KEY, JSON.stringify(validRooms));
  }

  private readRecentRoomsStorage(): any[] {
    const raw = localStorage.getItem(this.RECENT_ROOMS_KEY);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter(item => item && typeof item.id === 'string' && typeof item.lastVisitedAt === 'number')
        : [];
    } catch {
      return [];
    }
  }

  private loadExploreRooms() {
    this.roomService.getPublicRooms().subscribe({
      next: (rooms) => {
        this.exploreRooms = (rooms || []).map((room) => ({
          id: room.roomId,
          name: room.name || `Phòng ${room.roomId}`,
          host: room.hostId || 'Unknown',
          listeners: Array.isArray(room.members) ? room.members.length : 0,
          genre: 'Public'
        }));
      },
      error: (error) => {
        console.error('Load public rooms failed', error);
        this.exploreRooms = [];
      }
    });
  }
}
