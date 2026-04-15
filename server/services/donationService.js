/**
 * Сервис для работы с пожертвованиями
 * Интеграция с платежными системами
 */

const Donation = require('../Model/DonationModel');
const Shelter = require('../Model/ShelterModel');
const Pet = require('../Model/PetModel');
const { getClientBaseUrl } = require('../utils/clientBaseUrl');

/**
 * Создать пожертвование
 */
async function createDonation(donationData) {
  try {
    // Валидация данных
    if (!donationData.amount || donationData.amount < 0.01) {
      throw new Error('Минимальная сумма пожертвования: 0.01');
    }

    // Проверка существования приюта/питомца (если указаны)
    if (donationData.shelterId) {
      const shelter = await Shelter.findById(donationData.shelterId);
      if (!shelter) {
        throw new Error('Приют не найден');
      }
    }

    if (donationData.petId) {
      const pet = await Pet.findById(donationData.petId);
      if (!pet) {
        throw new Error('Питомец не найден');
      }
    }

    // Создаем пожертвование
    const donation = new Donation({
      ...donationData,
      paymentStatus: 'pending'
    });

    // Генерируем URL для оплаты (заглушка, будет заменена на реальную интеграцию)
    donation.paymentUrl = await generatePaymentUrl(donation);

    await donation.save();
    console.log('✅ Пожертвование создано:', donation._id);

    return donation;
  } catch (error) {
    console.error('❌ Ошибка создания пожертвования:', error);
    throw error;
  }
}

/**
 * Генерация URL для оплаты (заглушка для YooKassa)
 * В реальном проекте здесь будет интеграция с YooKassa API
 */
async function generatePaymentUrl(donation) {
  const clientBaseUrl = getClientBaseUrl();

  // TODO: Интеграция с YooKassa
  // Пример структуры:
  // const yookassa = require('yookassa');
  // const payment = await yookassa.createPayment({
  //   amount: { value: donation.amount, currency: donation.currency },
  //   confirmation: { type: 'redirect', return_url: 'https://your-site.com/donations/success' },
  //   description: `Пожертвование ${donation.purpose}`
  // });
  // return payment.confirmation.confirmation_url;

  // Временная заглушка
  return `${clientBaseUrl}/donations/pay/${donation._id}`;
}

/**
 * Обновить статус платежа
 */
async function updatePaymentStatus(donationId, paymentId, status, metadata = {}) {
  try {
    const donation = await Donation.findById(donationId);
    if (!donation) {
      throw new Error('Пожертвование не найдено');
    }

    donation.paymentStatus = status;
    donation.paymentId = paymentId || donation.paymentId;

    if (status === 'completed') {
      donation.paidAt = new Date();
    } else if (status === 'cancelled') {
      donation.cancelledAt = new Date();
    }

    // Обновляем дополнительные поля из metadata
    Object.assign(donation, metadata);

    await donation.save();
    console.log(`✅ Статус пожертвования ${donationId} обновлен: ${status}`);

    return donation;
  } catch (error) {
    console.error('❌ Ошибка обновления статуса:', error);
    throw error;
  }
}

/**
 * Получить пожертвования пользователя
 */
async function getUserDonations(userId, options = {}) {
  try {
    const query = { userId };
    
    if (options.status) {
      query.paymentStatus = options.status;
    }

    const donations = await Donation.find(query)
      .populate('shelterId', 'name')
      .populate('petId', 'name species breed')
      .sort({ createdAt: -1 })
      .limit(options.limit || 50);

    return donations;
  } catch (error) {
    console.error('❌ Ошибка получения пожертвований:', error);
    throw error;
  }
}

/**
 * Получить пожертвования для приюта
 */
async function getShelterDonations(shelterId, options = {}) {
  try {
    const query = { shelterId, paymentStatus: 'completed' };
    
    const donations = await Donation.find(query)
      .populate('userId', 'email')
      .populate('petId', 'name')
      .sort({ createdAt: -1 })
      .limit(options.limit || 100);

    // Подсчитываем статистику
    const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);
    const count = donations.length;

    return {
      donations,
      stats: {
        totalAmount,
        count,
        averageAmount: count > 0 ? totalAmount / count : 0
      }
    };
  } catch (error) {
    console.error('❌ Ошибка получения пожертвований приюта:', error);
    throw error;
  }
}

/**
 * Получить пожертвования для питомца
 */
async function getPetDonations(petId) {
  try {
    const donations = await Donation.find({
      petId,
      paymentStatus: 'completed'
    })
      .populate('userId', 'email')
      .sort({ createdAt: -1 });

    const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);

    return {
      donations,
      totalAmount,
      count: donations.length
    };
  } catch (error) {
    console.error('❌ Ошибка получения пожертвований питомца:', error);
    throw error;
  }
}

/**
 * Получить общую статистику пожертвований
 */
async function getDonationStats(options = {}) {
  try {
    const query = { paymentStatus: 'completed' };
    
    if (options.shelterId) {
      query.shelterId = options.shelterId;
    }

    const donations = await Donation.find(query);
    
    const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);
    const count = donations.length;
    const averageAmount = count > 0 ? totalAmount / count : 0;

    // Статистика по месяцам
    const monthlyStats = {};
    donations.forEach(donation => {
      const month = new Date(donation.paidAt || donation.createdAt).toISOString().slice(0, 7);
      if (!monthlyStats[month]) {
        monthlyStats[month] = { amount: 0, count: 0 };
      }
      monthlyStats[month].amount += donation.amount;
      monthlyStats[month].count += 1;
    });

    return {
      totalAmount,
      count,
      averageAmount,
      monthlyStats
    };
  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error);
    throw error;
  }
}

/**
 * Отменить пожертвование
 */
async function cancelDonation(donationId, userId) {
  try {
    const donation = await Donation.findById(donationId);
    
    if (!donation) {
      throw new Error('Пожертвование не найдено');
    }

    if (donation.userId && donation.userId.toString() !== userId.toString()) {
      throw new Error('Нет прав на отмену этого пожертвования');
    }

    if (!donation.canBeCancelled()) {
      throw new Error('Пожертвование нельзя отменить');
    }

    donation.paymentStatus = 'cancelled';
    donation.cancelledAt = new Date();
    await donation.save();

    return donation;
  } catch (error) {
    console.error('❌ Ошибка отмены пожертвования:', error);
    throw error;
  }
}

module.exports = {
  createDonation,
  updatePaymentStatus,
  getUserDonations,
  getShelterDonations,
  getPetDonations,
  getDonationStats,
  cancelDonation
};

