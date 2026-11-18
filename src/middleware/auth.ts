import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { resolveAuthenticatedUser } from '../db/repository.ts';
import type { User } from '../types/index.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: User;
  isRealAdmin?: boolean;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Não autenticado: token ausente.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Não autenticado: token inválido.' });
    return;
  }

  let decodedToken: DecodedIdToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(token);
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    return;
  }

  if (!decodedToken.email || decodedToken.email_verified !== true) {
    res.status(403).json({
      error:
        'Acesso negado: confirme o link de verificação enviado para o seu e-mail antes de acessar o sistema.',
    });
    return;
  }

  try {
    const authResult = await resolveAuthenticatedUser({
      uid: decodedToken.uid,
      email: decodedToken.email,
      displayName: decodedToken.name,
    });

    if (!authResult.authorized || !authResult.user) {
      res.status(403).json({
        error: authResult.errorMessage || 'Acesso não autorizado.',
      });
      return;
    }

    req.user = decodedToken;
    req.dbUser = authResult.user;
    req.isRealAdmin = authResult.isRealAdmin;
    next();
  } catch (error) {
    console.error('Auth database verification error:', error);
    res.status(500).json({ error: 'Erro interno ao validar acesso no banco de dados.' });
  }
};

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.isRealAdmin || !req.dbUser?.isAdmin) {
    res.status(403).json({
      error: 'Acesso restrito ao Administrador principal.',
    });
    return;
  }
  next();
};

export const requireDirectDelete = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.dbUser || (!req.dbUser.isAdmin && !req.dbUser.canDelete)) {
    res.status(403).json({
      error:
        'Você não possui permissão para excluir registros diretamente. Utilize a opção "Solicitar exclusão".',
    });
    return;
  }
  next();
};
