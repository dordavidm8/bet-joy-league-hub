import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMyBets, getMyReferralCode, updateAvatar, updateProfile, deleteAccount, getMyAchievements, getDetailedStats, ACHIEVEMENTS, getWaStatus, linkPhone, verifyPhone, unlinkPhone, setWaOptIn } from "@/lib/api";
import AvatarUploader from "@/components/AvatarUploader";
import { motion } from "framer-motion";
import { LogOut, Copy, Check, Camera, ChevronRight, Pencil, X, Smartphone, Share2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";


const ProfilePage = () => {
  const { backendUser, firebaseUser, signOut, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showAvatarUploader, setShowAvatarUploader] = useState(false);


  // Settings edit state
  const [editField, setEditField] = useState<'username' | 'display_name' | 'password' | null>(null);
  const [fieldValue, setFieldValue] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [fieldSuccess, setFieldSuccess] = useState('');
  const [fieldLoading, setFieldLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [waExpanded, setWaExpanded] = useState(false);


  const { data: betsData } = useQuery({ queryKey: ["my-bets"], queryFn: () => getMyBets({ limit: 5 }) });
  const { data: referralData } = useQuery({ queryKey: ["my-referral"], queryFn: getMyReferralCode });
  const { data: achievementsData } = useQuery({ queryKey: ["my-achievements"], queryFn: getMyAchievements });
  const { data: detailedStats } = useQuery({ queryKey: ["my-detailed-stats"], queryFn: getDetailedStats });


  const [avatarSaveError, setAvatarSaveError] = useState<string | null>(null);

