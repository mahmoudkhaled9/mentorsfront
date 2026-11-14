import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { emitAuthChange, errorMessage } from '@/lib/api';
import { jsonRequest } from '@/lib/mutations';
import { checkPhone } from '@/lib/phone';
import { passwordProblem } from '@/lib/passwords';
import type { User } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function Profile() {
  const { user, updateCurrentUser, replaceToken } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [selectedAvatarName, setSelectedAvatarName] = useState('');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
    setPhone(user?.phone ?? '');
    setAvatar(user?.avatar ?? '');
    setSelectedAvatarName('');
  }, [user]);

  const resizeAvatar = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      throw new Error('Please select an image file');
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsDataURL(file);
    });

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${file.name}`));
      img.src = dataUrl;
    });

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas is not supported in this browser');
    }

    const sourceSize = Math.min(image.width, image.height);
    const sourceX = Math.max(0, Math.floor((image.width - sourceSize) / 2));
    const sourceY = Math.max(0, Math.floor((image.height - sourceSize) / 2));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.9);
  };

  const handleAvatarChange = async (file: File | null) => {
    if (!file) return;
    try {
      const cropped = await resizeAvatar(file);
      setAvatar(cropped);
      setSelectedAvatarName(file.name);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const handleRemoveAvatar = () => {
    setAvatar('');
    setSelectedAvatarName('');
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async () => {
    if (!name.trim() || !phone.trim() || !email.trim()) {
      toast.error('Name, email, and phone are required');
      return;
    }
    const phoneCheck = checkPhone(phone, { keep: user?.phone, kind: 'employee' });
    if (!phoneCheck.ok) {
      toast.error(phoneCheck.message);
      return;
    }
    setSavingProfile(true);
    try {
      const payload = await jsonRequest<{ user?: User }>('profile', {
        method: 'PUT',
        body: { name: name.trim(), email: email.trim(), phone: phoneCheck.value, avatar: avatar.trim() },
      });
      const nextUser = payload?.user ?? user ?? null;
      if (nextUser) {
        updateCurrentUser({
          ...(user ?? {}),
          ...nextUser,
        });
      }
      emitAuthChange();
      toast.success('Profile updated');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim() || !newPassword.trim()) {
      toast.error('Current password and new password are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password confirmation does not match');
      return;
    }
    const weak = passwordProblem(newPassword, { email: user?.email, name: user?.name });
    if (weak) {
      toast.error(weak);
      return;
    }
    setSavingPassword(true);
    try {
      const result = await jsonRequest<{ token?: string }>('auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      // Changing the password signs out every older session; keep THIS one by switching to the new token.
      if (result.token) replaceToken(result.token);
      toast.success('Password changed');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile & Security</h1>
        <p className="text-sm text-gray-500 mt-1">
          Update your account details and password.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your visible account information.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={`/profile/${user?.id ?? ''}`} onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }} className="space-y-4">
            <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={avatar || undefined} alt={user?.name ?? 'User'} />
              <AvatarFallback>{(user?.name ?? 'U').slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Label htmlFor="avatarUpload">Profile Picture</Label>
              <div className="flex flex-col gap-3">
                <Input
                  ref={avatarInputRef}
                  id="avatarUpload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleAvatarChange(e.target.files?.[0] ?? null)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    Choose File
                  </Button>
                  <Button variant="outline" size="sm" type="button" onClick={handleRemoveAvatar} disabled={!avatar} title={avatar ? undefined : 'No picture to remove'}>
                    Remove Picture
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  {selectedAvatarName
                    ? `Selected: ${selectedAvatarName}`
                    : 'Choose an image from your device. It will be cropped to a square and resized before saving.'}
                </p>
                <p className="text-xs text-gray-500">
                  The image is saved with your profile and used everywhere you log in.
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="id">User ID</Label>
              <Input id="id" value={user?.id ?? ''} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Change your password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleChangePassword} disabled={savingPassword}>
            {savingPassword ? 'Updating...' : 'Change Password'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
