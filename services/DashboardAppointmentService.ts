import connectDB from '../lib/mongodb.js';
import Appointment from '../models/Appointment.js';
import { Types } from 'mongoose';
import { 
  AppointmentStatus, 
  DashboardAppointment, 
  AppointmentQuery,
  PublicAppointment 
} from '../appointments/types/appointments.types';

export class DashboardAppointmentService {
  // Helper function to convert DashboardAppointment to PublicAppointment
  convertToPublicAppointment(appointment: DashboardAppointment): PublicAppointment {
    return {
      id: appointment.id,
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      status: appointment.status,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
      patientInfo: {
        firstName: appointment.patientId.split('@')[0], // Simplified conversion
        lastName: '',
        email: appointment.patientId,
        phone: ''
      },
      service: appointment.service,
      notes: appointment.notes
    };
  }

  // Transform MongoDB appointment to DashboardAppointment interface
  private transformToDashboardAppointment(apt: any): DashboardAppointment {
    return {
      id: (apt._id as Types.ObjectId).toString(),
      date: apt.preferredDate,
      startTime: new Date(apt.preferredDate).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      }),
      endTime: new Date(new Date(apt.preferredDate).getTime() + 60 * 60 * 1000).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      }), // Assuming 1 hour appointments
      status: apt.status as AppointmentStatus,
      createdAt: apt.createdAt,
      updatedAt: apt.updatedAt,
      patientId: apt.email,
      service: apt.appointmentType,
      notes: apt.notes || `Health Concerns: ${apt.healthConcerns || 'None'}\nAllergies: ${apt.allergies || 'None'}\nMedications: ${apt.medications || 'None'}`,
      history: [{
        id: '1',
        appointmentId: (apt._id as Types.ObjectId).toString(),
        status: apt.status as AppointmentStatus,
        changedAt: apt.updatedAt,
        changedBy: 'system',
        notes: apt.source ? `Imported from ${apt.source}` : undefined
      }]
    };
  }

  async getAppointments(date?: string, status?: AppointmentStatus): Promise<DashboardAppointment[]> {
    await connectDB();
    
    const query: AppointmentQuery = {};
    
    if (date) {
      // Get appointments for a specific date
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      query.preferredDate = {
        $gte: startDate,
        $lte: endDate
      };
    }
    
    if (status) {
      query.status = status;
    }
    
    // If no filters provided, get all appointments
    const appointments = await Appointment.find(query)
      .sort({ preferredDate: -1 })
      .lean();
    
    return appointments.map(apt => this.transformToDashboardAppointment(apt));
  }

  async getAppointmentById(id: string): Promise<DashboardAppointment | null> {
    await connectDB();
    
    const appointment = await Appointment.findById(id).lean();
    if (!appointment) {
      return null;
    }
    
    return this.transformToDashboardAppointment(appointment);
  }

  async deleteAppointment(id: string): Promise<DashboardAppointment | null> {
    await connectDB();
    
    const result = await Appointment.findByIdAndDelete(id).lean();
    if (!result) {
      return null;
    }
    
    return this.transformToDashboardAppointment(result);
  }

  async bulkDeleteAppointments(ids: string[]): Promise<{ deletedCount: number }> {
    await connectDB();
    
    const result = await Appointment.deleteMany({
      _id: { $in: ids.map(id => new Types.ObjectId(id)) }
    });
    
    return { deletedCount: result.deletedCount || 0 };
  }
}