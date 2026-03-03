enum UserStatus {
  ONLINE = "online",
  OFFLINE = "offline",
  BUSY = "busy",
  AWAY = "away",
}

enum UserRole {
  USER = "user",
  ADMIN = "admin",
}

export class User {
  private id: string;
  private email: string;
  private username: string;
  private displayName!: string;
  private avatarUrl!: string;
  private bio!: string;
  private passwordHash!: string;
  private is2FAEnabled: boolean = false;
  private twoFASecret!: string;
  private status: string = UserStatus.OFFLINE;
  private role: string = UserRole.USER;
  private lastSeenAt!: Date;
  private createdAt: Date = new Date();
  private updatedAt: Date;

  // Relationships -- Uncomment when related entities are defined
  // private oAuthAccounts: OAuthAccount[] = [];
  // private sentMessages: Messages[] = [];
  // private sentFriendRequests: FriendRequest[] = [];
  // private receivedFriendRequests: FriendRequest[] = []
  // private notifications: Notification[] = [];
  // private files: File[] = [];
  // private apiKeys: APIKey[] = [];
  // private channelMembers: ChannelMember[] = [];

  constructor(id: string, email: string, username: string) {
    this.id = id;
    this.email = email;
    this.username = username;
    this.updatedAt = new Date();
  }
}
