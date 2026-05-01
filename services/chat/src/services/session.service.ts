import {
  DiagnosisSession,
  IDiagnosisSession,
  SessionMessage,
} from '../models/session.model';

export const sessionService = {
  async create(data: {
    userId: string;
    profileId?: string;
    userProfile: IDiagnosisSession['userProfile'];
  }): Promise<IDiagnosisSession> {
    return DiagnosisSession.create({
      userId: data.userId,
      profileId: data.profileId,
      userProfile: data.userProfile,
      status: 'IN_PROGRESS',
      stage: 1,
      messages: [],
      questionCount: 0,
      redFlagTriggered: false,
      llmFailureCount: 0,
    });
  },

  async getById(id: string): Promise<IDiagnosisSession | null> {
    return DiagnosisSession.findById(id);
  },

  async getActiveByUser(userId: string): Promise<IDiagnosisSession | null> {
    return DiagnosisSession.findOne({ userId, status: 'IN_PROGRESS' }).sort({ createdAt: -1 });
  },

  async getHistoryByUser(userId: string, limit = 20, offset = 0): Promise<IDiagnosisSession[]> {
    return DiagnosisSession.find({ userId })
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(limit);
  },

  async abandon(id: string): Promise<IDiagnosisSession | null> {
    return DiagnosisSession.findByIdAndUpdate(
      id,
      { $set: { status: 'ABANDONED' } },
      { new: true },
    );
  },

  async update(
    id: string,
    data: Partial<IDiagnosisSession>,
  ): Promise<IDiagnosisSession | null> {
    return DiagnosisSession.findByIdAndUpdate(id, { $set: data }, { new: true });
  },

  async addMessage(
    id: string,
    message: SessionMessage,
  ): Promise<IDiagnosisSession | null> {
    return DiagnosisSession.findByIdAndUpdate(
      id,
      { $push: { messages: message } },
      { new: true },
    );
  },

  async incrementLLMFailure(id: string): Promise<IDiagnosisSession | null> {
    return DiagnosisSession.findByIdAndUpdate(
      id,
      { $inc: { llmFailureCount: 1 } },
      { new: true },
    );
  },

};
